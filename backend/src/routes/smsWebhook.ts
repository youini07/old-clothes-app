import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { prisma, REQUEST_LIGHT_SELECT } from '../lib/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/authMiddleware';
import {
  isObviousSpamOrSystemSms,
  parseSmsContentWithAiOrFallback,
  normalizeAddressWithKakao,
  standardizeProvinceName,
  getSmsAiRuntimeHealth,
  resetSmsAiRuntimeErrors,
} from '../services/smsAiParser';
import { sendNewRequestToPartner } from '../services/notificationService';
import { getRepresentativePhone } from '../services/representativePhoneService';
import { getIo } from '../socket';

const router = express.Router();

let schemaColumnsEnsured = false;
let geminiRestoredOnce = false;

/**
 * 왜 서버 부팅 시 무중단 컬럼 보장과 Gemini 키 복원을 함께 수행하는가:
 * 1) 로컬 개발 환경(npm run dev)에서 별도의 수동 마이그레이션 명령 없이 바로 실행하더라도
 *    Request.requestSource / rawSmsText 컬럼 누락으로 인한 500 에러가 절대 발생하지 않도록 방어합니다.
 * 2) Railway 등 클라우드 컨테이너는 재배포 시 .env 파일이 초기화되므로, 슈퍼관리자가 저장한
 *    GEMINI_API_KEY를 GlobalSettings 테이블에서 런타임 환경변수로 즉시 복원합니다.
 */
export async function ensureSmsSchemaColumnsAndGeminiKey(): Promise<void> {
  try {
    if (!schemaColumnsEnsured) {
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "Request" ADD COLUMN IF NOT EXISTS "requestSource" TEXT NOT NULL DEFAULT \'WEB\';'
      );
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "Request" ADD COLUMN IF NOT EXISTS "rawSmsText" TEXT;'
      );
      await prisma.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS "Request_requestSource_createdAt_idx" ON "Request"("requestSource", "createdAt");'
      );
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "GlobalSettings" ADD COLUMN IF NOT EXISTS "representativePhone" TEXT;'
      );
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "GlobalSettings" ADD COLUMN IF NOT EXISTS "geminiApiKey" TEXT;'
      );
      schemaColumnsEnsured = true;
    }

    if (geminiRestoredOnce) return;
    geminiRestoredOnce = true;

    const currentEnvKey = (process.env.GEMINI_API_KEY || '').trim();
    if (currentEnvKey && !currentEnvKey.startsWith('your_')) {
      return;
    }

    const rows = await prisma.$queryRawUnsafe<Array<{ geminiApiKey: string | null }>>(
      'SELECT "geminiApiKey" FROM "GlobalSettings" WHERE "id" = \'global\' LIMIT 1;'
    );
    const savedKey = (rows?.[0]?.geminiApiKey || '').trim();
    if (savedKey && !savedKey.startsWith('your_')) {
      process.env.GEMINI_API_KEY = savedKey;
    }
  } catch (err) {
    console.warn('[SMS Bootstrap] 스키마/Gemini 키 확인 중 경고 (무시 가능):', err);
  }
}

/**
 * 왜 발신 전화번호를 010-XXXX-XXXX 형식으로 정규화하는가:
 * 안드로이드 문자 앱·통신사마다 '+821012345678', '821012345678', '01012345678' 등 포맷이 제각각이므로
 * DB 고객 이력 매칭과 콜백 통화 편의를 위해 표준 하이픈 형식으로 통일합니다.
 */
export function normalizeKoreanPhone(rawPhone: string): string {
  if (!rawPhone) return '010-0000-0000';
  let digits = String(rawPhone).replace(/\D/g, '');

  if (digits.startsWith('82') && digits.length >= 11) {
    digits = '0' + digits.slice(2);
  }

  if (digits.length === 11 && digits.startsWith('01')) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    if (digits.startsWith('02')) {
      return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return rawPhone.trim();
}

/**
 * 왜 다중 JSON/쿼리 키 매핑을 지원하는가:
 * 올클 전용 APK(allclear-app.apk)뿐 아니라 MacroDroid, SMS Forwarder 등 시중의 어떤 문자 전달 앱을
 * 사용하더라도 별도 코드 수정 없이 100% 호환되도록 설계했습니다.
 */
function extractSmsPayload(req: express.Request): { senderPhone: string; messageContent: string } {
  const src = { ...(req.query as Record<string, any>), ...(req.body as Record<string, any>) };

  const rawSender =
    src.senderPhone ||
    src.from ||
    src.sender ||
    src.phone ||
    src.inNumber ||
    src.number ||
    src.caller ||
    '';

  const rawMessage =
    src.messageContent ||
    src.text ||
    src.message ||
    src.body ||
    src.msg ||
    src.content ||
    src.sms ||
    '';

  return {
    senderPhone: normalizeKoreanPhone(String(rawSender)),
    messageContent: String(rawMessage).trim(),
  };
}

/**
 * 왜 희망일 미지정 문자 신청의 기본 방문 희망일을 내일(KST)로 산정하는가:
 * 당일 출동 기사님의 동선은 이미 확정되어 운행 중인 경우가 많으므로,
 * 고객이 별도 날짜를 적지 않은 문자는 익일 수거 대기로 안전하게 귀속시킵니다.
 */
function resolveSmsDesiredDate(desiredDateISO?: string | null): Date {
  if (desiredDateISO && /^\d{4}-\d{2}-\d{2}$/.test(desiredDateISO)) {
    const parsed = new Date(`${desiredDateISO}T09:00:00+09:00`);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  nowKst.setUTCDate(nowKst.getUTCDate() + 1);
  const tomorrowIso = nowKst.toISOString().split('T')[0];
  return new Date(`${tomorrowIso}T09:00:00+09:00`);
}

/**
 * 공통 파이프라인: 문자 1건을 스팸 필터링 -> AI/정규식 파싱 -> 카카오 주소 정규화 -> DB 등록(또는 연속 보충문자 병합) 수행
 */
async function processIncomingSmsToRequest(
  senderPhone: string,
  messageContent: string,
  options: {
    saveToDb: boolean;
    targetPartnerId?: string | null;
    isSimulation?: boolean;
  }
) {
  await ensureSmsSchemaColumnsAndGeminiKey();

  // 1단계: 스팸 / 광고 / 시스템 알림 문자 필터링
  const spamCheck = isObviousSpamOrSystemSms(messageContent);
  if (spamCheck.isSpam) {
    return {
      registered: false,
      skippedReason: spamCheck.reason,
      analysis: null,
      normalizedAddress: null,
      request: null,
    };
  }

  const analysis = await parseSmsContentWithAiOrFallback(messageContent);

  // 2단계: 실제 공기계 웹훅 수신 시 최근 10분 내 동일 발신자의 연속 보충문자(예: 공동현관 비번, 물량 추가 전송) 자동 병합
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  if (
    !options.isSimulation &&
    options.saveToDb &&
    senderPhone &&
    senderPhone !== '010-0000-0000'
  ) {
    const recentSmsReq = await prisma.request.findFirst({
      where: {
        phone: senderPhone,
        requestSource: 'SMS',
        status: { in: ['PENDING', 'ASSIGNED'] },
        createdAt: { gte: tenMinutesAgo },
      },
      orderBy: { createdAt: 'desc' },
      select: REQUEST_LIGHT_SELECT,
    });

    if (recentSmsReq) {
      if (recentSmsReq.rawSmsText && recentSmsReq.rawSmsText.includes(messageContent)) {
        return {
          registered: false,
          deduplicated: true,
          skippedReason: '최근 10분 내 동일 문자 중복 수신으로 무시됨',
          analysis: null,
          normalizedAddress: null,
          request: recentSmsReq,
        };
      }

      const existingHasConfirmedAddr =
        Boolean(recentSmsReq.address) && !recentSmsReq.address.startsWith('[주소확인필요]');
      const newMsgHasOwnDistinctAddress = Boolean(analysis.isPickupRequest && analysis.rawAddress);

      if (!(existingHasConfirmedAddr && newMsgHasOwnDistinctAddress)) {
        const mergedSmsText = `${recentSmsReq.rawSmsText || ''}\n[추가문자] ${messageContent}`.trim();
        const followUpNormalized = analysis.rawAddress
          ? await normalizeAddressWithKakao(analysis.rawAddress)
          : null;

        const updatedRequest = await prisma.request.update({
          where: { id: recentSmsReq.id },
          data: {
            rawSmsText: mergedSmsText,
            address: followUpNormalized?.isVerified
              ? followUpNormalized.standardAddress
              : recentSmsReq.address,
            detailAddress: analysis.detailAddress || recentSmsReq.detailAddress,
            estimatedVolume: analysis.itemsSummary
              ? `[문자신청] ${analysis.itemsSummary}`
              : recentSmsReq.estimatedVolume,
          },
          select: REQUEST_LIGHT_SELECT,
        });

        return {
          registered: true,
          mergedWithExisting: true,
          analysis,
          normalizedAddress: followUpNormalized,
          request: updatedRequest,
        };
      }
    }
  }

  // 3단계: 수거 신청 또는 주소 단서 여부 판별
  if (!analysis.isPickupRequest && !analysis.hasPickupIntentWithoutAddress) {
    return {
      registered: false,
      skippedReason: '수거 신청 또는 주소 단서가 포함된 문자가 아님',
      analysis,
      normalizedAddress: null,
      request: null,
    };
  }

  // 4단계: 카카오 로컬 주소/장소 API로 대한민국 표준 도로명 주소·우편번호·행정구역 보정
  const normalizedAddress = analysis.rawAddress
    ? await normalizeAddressWithKakao(analysis.rawAddress)
    : null;

  if (!options.saveToDb) {
    return {
      registered: false,
      previewOnly: true,
      analysis,
      normalizedAddress,
      request: null,
    };
  }

  // 5단계: 권역(Region) 조회 및 담당 파트너 알림 대상 확인
  let province = standardizeProvinceName(normalizedAddress?.province || '');
  let city = normalizedAddress?.city || '';
  if ((!province || !city) && analysis.rawAddress) {
    const parts = analysis.rawAddress.split(' ');
    province = standardizeProvinceName(parts[0] || '');
    city = parts[1] || '';
  }

  let regionId: string | null = null;
  let partnerToNotify: { phone: string | null; useBizMessage: boolean } | null = null;

  if (province && city) {
    const baseCity = city.trim().split(' ')[0] || city.trim();
    const region = await prisma.region.findFirst({
      where: {
        province,
        OR: [{ city: city.trim() }, { city: baseCity }],
      },
      include: { coverages: { include: { partner: true } } },
    });
    if (region) {
      regionId = region.id;
      if (region.coverages.length > 0) {
        partnerToNotify = region.coverages[0].partner;
      }
    }
  }

  const desiredDate = resolveSmsDesiredDate(analysis.desiredDateISO);

  // 카카오 표준주소로 명확히 검증된 경우 정식 주소를 기입하고, 약식/미검증 문자는 '[주소확인필요]'로 표시해 사장님이 원문을 보고 1클릭 보정할 수 있게 함
  const finalAddress = normalizedAddress?.isVerified
    ? normalizedAddress.standardAddress
    : analysis.rawAddress
    ? `[주소확인필요] ${analysis.rawAddress}`
    : '[주소확인필요]';
  const finalDetailAddress = analysis.detailAddress || '';
  const finalUserName = analysis.customerName ? `[문자] ${analysis.customerName}` : '💬 문자간편신청';
  const finalVolume = analysis.itemsSummary ? `[문자신청] ${analysis.itemsSummary}` : '문자 접수 (원문 확인)';

  // 6단계: 수거신청(Request) 테이블에 문자신청(requestSource: 'SMS')으로 자동 등록
  const newRequest = await prisma.request.create({
    data: {
      userName: finalUserName,
      phone: senderPhone || '010-0000-0000',
      address: finalAddress,
      detailAddress: finalDetailAddress,
      zipCode: normalizedAddress?.zipCode || '00000',
      sigungu: normalizedAddress?.city || city || null,
      bname: normalizedAddress?.town || null,
      desiredDate,
      isMustPickupDate: false,
      estimatedVolume: finalVolume,
      status: options.targetPartnerId && !options.isSimulation ? 'ASSIGNED' : 'PENDING',
      partnerId: options.isSimulation ? null : options.targetPartnerId || null,
      regionId,
      customerId: null,
      requestSource: 'SMS',
      rawSmsText: messageContent,
    },
    select: REQUEST_LIGHT_SELECT,
  });

  // 7단계: 담당 파트너 사장님께 신규 문자 신청 알림 발송 (비동기)
  if (partnerToNotify?.phone) {
    sendNewRequestToPartner(
      partnerToNotify.phone,
      newRequest.userName,
      newRequest.address,
      partnerToNotify.useBizMessage
    ).catch((err) => console.error('[SMS Webhook] 파트너 알림 발송 실패:', err));
  }

  return {
    registered: true,
    analysis,
    normalizedAddress,
    request: newRequest,
  };
}

/**
 * [1] 010 안드로이드 공기계 전용 앱(allclear-app.apk) 및 외부 포워더 인바운드 웹훅
 * - GET과 POST를 모두 허용해 설정 실수로 인한 유실을 0%로 방지하며,
 * - 등록 즉시 Socket.IO 브로드캐스트를 발행해 사장님 PC 대시보드 화면을 새로고침 없이 자동 갱신합니다.
 */
async function handleIncomingSmsWebhook(req: express.Request, res: express.Response) {
  try {
    const configuredSecret = (process.env.SMS_WEBHOOK_SECRET || '').trim();
    if (configuredSecret) {
      const headerSecret =
        (req.headers['x-webhook-secret'] as string) ||
        (req.headers.authorization?.replace(/^Bearer\s+/i, '') ?? '');
      const querySecret = String(req.query.secret || req.body?.secret || '');

      if (headerSecret !== configuredSecret && querySecret !== configuredSecret) {
        return res.status(401).json({ error: '유효하지 않은 SMS 웹훅 보안 키입니다.' });
      }
    }

    const { senderPhone, messageContent } = extractSmsPayload(req);
    if (!messageContent) {
      return res.status(400).json({ error: '문자 본문(messageContent / text)이 비어 있습니다.' });
    }

    const result = await processIncomingSmsToRequest(senderPhone, messageContent, {
      saveToDb: true,
    });

    if (result.registered) {
      try {
        getIo().emit('requests_reordered');
      } catch {
        // 소켓 초기화 전 호출 시 안전 무시
      }
    }

    return res.status(result.registered ? 201 : 200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[SMS Webhook Error] 문자 자동 접수 처리 중 오류:', error);
    return res.status(500).json({ error: '문자 자동 접수 처리 중 서버 오류가 발생했습니다.' });
  }
}

router.get('/webhook', handleIncomingSmsWebhook);
router.post('/webhook', handleIncomingSmsWebhook);

/**
 * [1-B] 올클 전용 안드로이드 앱(allclear-app.apk) '1초 서버 연결 확인' 엔드포인트
 */
router.get('/ping', async (req, res) => {
  const configuredSecret = (process.env.SMS_WEBHOOK_SECRET || '').trim();
  const providedSecret = String(
    req.headers['x-webhook-secret'] || req.query.secret || ''
  ).trim();
  const secretValid = !configuredSecret || providedSecret === configuredSecret;
  const representativePhone = await getRepresentativePhone();

  return res.status(secretValid ? 200 : 401).json({
    ok: secretValid,
    secretValid,
    representativePhone,
    serverTime: new Date().toISOString(),
    message: secretValid
      ? `올클 서버 연결 정상${representativePhone ? ` (대표번호: ${representativePhone})` : ''}`
      : '서버 통신은 성공했으나 웹훅 보안키가 일치하지 않습니다.',
  });
});

/**
 * [1-C] 사무실 010 대표번호 공기계 전용 문자 자동접수 APK 다운로드
 * GET /api/sms/apk
 */
router.get('/apk', (_req, res) => {
  const candidatePaths = [
    path.resolve(__dirname, '../../public/downloads/allclear-app.apk'),
    path.resolve(process.cwd(), 'public/downloads/allclear-app.apk'),
    path.resolve(__dirname, '../../../frontend/public/downloads/allclear-app.apk'),
    path.resolve(__dirname, '../../../android-app/dist/allclear-app.apk'),
    path.resolve(process.cwd(), '../frontend/public/downloads/allclear-app.apk'),
  ];

  const foundApk = candidatePaths.find((p) => fs.existsSync(p));
  if (!foundApk) {
    return res.status(404).json({
      error: '빌드된 allclear-app.apk 파일을 찾을 수 없습니다.',
    });
  }

  res.setHeader('Content-Type', 'application/vnd.android.package-archive');
  res.setHeader('Content-Disposition', 'attachment; filename="allclear-app.apk"');
  res.setHeader('Cache-Control', 'no-store');
  return res.sendFile(foundApk);
});

/**
 * [2] 관리자 대시보드용: 문자 자동접수 연동 상태 및 안드로이드 앱 설정 정보 조회
 * GET /api/sms/config
 */
router.get(
  '/config',
  authenticate,
  requireRole(['PARTNER', 'SUPER_ADMIN']),
  async (req: AuthRequest, res) => {
    await ensureSmsSchemaColumnsAndGeminiKey();
    const geminiKey = (process.env.GEMINI_API_KEY || '').trim();
    const openAiKey = (process.env.OPENAI_API_KEY || '').trim();
    const health = getSmsAiRuntimeHealth();

    let activeAnalyzer: 'GEMINI' | 'OPENAI' | 'REGEX_FALLBACK' = 'REGEX_FALLBACK';
    let aiStatusWarning: string | null = null;

    if (geminiKey && !geminiKey.startsWith('your_')) {
      if (health.lastGeminiRuntimeError) {
        activeAnalyzer = 'REGEX_FALLBACK';
        aiStatusWarning = health.lastGeminiRuntimeError;
      } else {
        activeAnalyzer = 'GEMINI';
      }
    } else if (openAiKey && !openAiKey.startsWith('your_')) {
      if (health.lastOpenAiRuntimeError) {
        activeAnalyzer = 'REGEX_FALLBACK';
        aiStatusWarning = health.lastOpenAiRuntimeError;
      } else {
        activeAnalyzer = 'OPENAI';
      }
    }

    const secret = (process.env.SMS_WEBHOOK_SECRET || 'allclear-sms-secret-2026').trim();
    const representativePhone = await getRepresentativePhone();
    const kakaoConfigured =
      Boolean(process.env.KAKAO_CLIENT_ID) &&
      process.env.KAKAO_CLIENT_ID !== '카카오_디벨로퍼스_REST_API_KEY';

    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.get('host') || 'localhost:5000';
    const webhookUrl = `${protocol}://${host}/api/sms/webhook?secret=${encodeURIComponent(secret)}`;
    const apkDownloadUrl = `${protocol}://${host}/api/sms/apk`;

    res.json({
      activeAnalyzer,
      aiStatusWarning,
      hasGeminiKey: Boolean(geminiKey && !geminiKey.startsWith('your_')),
      kakaoAddressVerified: kakaoConfigured,
      representativePhone,
      webhookUrl,
      apkDownloadUrl,
      defaultSecret: secret,
      sampleJsonPayload: JSON.stringify(
        {
          from: '%from%',
          text: '%text%',
        },
        null,
        2
      ),
    });
  }
);

/**
 * [2-B] 슈퍼관리자 전용 Gemini API 키 런타임 등록 및 DB 영구 저장 엔드포인트
 * POST /api/sms/gemini-key
 */
router.post(
  '/gemini-key',
  authenticate,
  requireRole(['SUPER_ADMIN']),
  async (req: AuthRequest, res) => {
    try {
      await ensureSmsSchemaColumnsAndGeminiKey();
      const rawKey = String(req.body?.geminiApiKey || '').trim();
      process.env.GEMINI_API_KEY = rawKey;
      resetSmsAiRuntimeErrors();

      await prisma.globalSettings.upsert({
        where: { id: 'global' },
        update: {},
        create: { id: 'global' },
      });
      await prisma.$executeRaw`UPDATE "GlobalSettings" SET "geminiApiKey" = ${rawKey || null} WHERE "id" = 'global'`;

      try {
        const envPath = path.resolve(__dirname, '../../.env');
        if (fs.existsSync(envPath)) {
          let envContent = fs.readFileSync(envPath, 'utf8');
          if (/^GEMINI_API_KEY=/m.test(envContent)) {
            envContent = envContent.replace(/^GEMINI_API_KEY=.*$/m, `GEMINI_API_KEY=${rawKey}`);
          } else {
            envContent = `${envContent.trimEnd()}\nGEMINI_API_KEY=${rawKey}\n`;
          }
          fs.writeFileSync(envPath, envContent, 'utf8');
        }
      } catch {
        // 읽기 전용 컨테이너 파일시스템에서는 안전하게 무시 (DB에 이미 영구 저장됨)
      }

      return res.json({
        success: true,
        hasGeminiKey: Boolean(rawKey),
        message: rawKey
          ? 'Google Gemini AI 키가 DB에 영구 저장되어 즉시 활성화되었습니다.'
          : 'Gemini AI 키가 해제되어 내장 한국어 파서 모드로 전환되었습니다.',
      });
    } catch (error) {
      console.error('[SMS Gemini Key Save Error]:', error);
      return res.status(500).json({ error: 'API 키 저장 중 오류가 발생했습니다.' });
    }
  }
);

/**
 * [3] 관리자 대시보드용: 문자 AI 인식 미리보기 & 테스트 접수 시뮬레이터
 * POST /api/sms/simulate
 */
router.post(
  '/simulate',
  authenticate,
  requireRole(['PARTNER', 'SUPER_ADMIN']),
  async (req: AuthRequest, res) => {
    try {
      const { senderPhone, messageContent, saveToDb = false } = req.body;
      if (!messageContent || String(messageContent).trim().length === 0) {
        return res.status(400).json({ error: '테스트할 문자 내용을 입력해 주세요.' });
      }

      const formattedPhone = normalizeKoreanPhone(String(senderPhone || '010-1234-5678'));
      const result = await processIncomingSmsToRequest(
        formattedPhone,
        String(messageContent).trim(),
        {
          saveToDb: Boolean(saveToDb),
          isSimulation: true,
        }
      );

      if (result.registered) {
        try {
          getIo().emit('requests_reordered');
        } catch {
          // 무시
        }
      }

      return res.status(result.registered ? 201 : 200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error('[SMS Simulate Error]:', error);
      return res.status(500).json({ error: '문자 시뮬레이션 처리 중 오류가 발생했습니다.' });
    }
  }
);

export default router;
