"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureSmsSchemaColumnsAndGeminiKey = ensureSmsSchemaColumnsAndGeminiKey;
exports.normalizeKoreanPhone = normalizeKoreanPhone;
const express_1 = __importDefault(require("express"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const prisma_1 = require("../lib/prisma");
const authMiddleware_1 = require("../middleware/authMiddleware");
const smsAiParser_1 = require("../services/smsAiParser");
const notificationService_1 = require("../services/notificationService");
const representativePhoneService_1 = require("../services/representativePhoneService");
const socket_1 = require("../socket");
const router = express_1.default.Router();
let schemaColumnsEnsured = false;
let geminiRestoredOnce = false;
/**
 * 왜 서버 부팅 시 무중단 컬럼 보장과 Gemini 키 복원을 함께 수행하는가:
 * 1) 로컬 개발 환경(npm run dev)에서 별도의 수동 마이그레이션 명령 없이 바로 실행하더라도
 *    Request.requestSource / rawSmsText 컬럼 누락으로 인한 500 에러가 절대 발생하지 않도록 방어합니다.
 * 2) Railway 등 클라우드 컨테이너는 재배포 시 .env 파일이 초기화되므로, 슈퍼관리자가 저장한
 *    GEMINI_API_KEY를 GlobalSettings 테이블에서 런타임 환경변수로 즉시 복원합니다.
 */
function ensureSmsSchemaColumnsAndGeminiKey() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            if (!schemaColumnsEnsured) {
                yield prisma_1.prisma.$executeRawUnsafe('ALTER TABLE "Request" ADD COLUMN IF NOT EXISTS "requestSource" TEXT NOT NULL DEFAULT \'WEB\';');
                yield prisma_1.prisma.$executeRawUnsafe('ALTER TABLE "Request" ADD COLUMN IF NOT EXISTS "rawSmsText" TEXT;');
                yield prisma_1.prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Request_requestSource_createdAt_idx" ON "Request"("requestSource", "createdAt");');
                yield prisma_1.prisma.$executeRawUnsafe('ALTER TABLE "GlobalSettings" ADD COLUMN IF NOT EXISTS "representativePhone" TEXT;');
                yield prisma_1.prisma.$executeRawUnsafe('ALTER TABLE "GlobalSettings" ADD COLUMN IF NOT EXISTS "geminiApiKey" TEXT;');
                schemaColumnsEnsured = true;
            }
            if (geminiRestoredOnce)
                return;
            geminiRestoredOnce = true;
            const currentEnvKey = (process.env.GEMINI_API_KEY || '').trim();
            if (currentEnvKey && !currentEnvKey.startsWith('your_')) {
                return;
            }
            const rows = yield prisma_1.prisma.$queryRawUnsafe('SELECT "geminiApiKey" FROM "GlobalSettings" WHERE "id" = \'global\' LIMIT 1;');
            const savedKey = (((_a = rows === null || rows === void 0 ? void 0 : rows[0]) === null || _a === void 0 ? void 0 : _a.geminiApiKey) || '').trim();
            if (savedKey && !savedKey.startsWith('your_')) {
                process.env.GEMINI_API_KEY = savedKey;
            }
        }
        catch (err) {
            console.warn('[SMS Bootstrap] 스키마/Gemini 키 확인 중 경고 (무시 가능):', err);
        }
    });
}
/**
 * 왜 발신 전화번호를 010-XXXX-XXXX 형식으로 정규화하는가:
 * 안드로이드 문자 앱·통신사마다 '+821012345678', '821012345678', '01012345678' 등 포맷이 제각각이므로
 * DB 고객 이력 매칭과 콜백 통화 편의를 위해 표준 하이픈 형식으로 통일합니다.
 */
function normalizeKoreanPhone(rawPhone) {
    if (!rawPhone)
        return '010-0000-0000';
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
function extractSmsPayload(req) {
    const src = Object.assign(Object.assign({}, req.query), req.body);
    const rawSender = src.senderPhone ||
        src.from ||
        src.sender ||
        src.phone ||
        src.inNumber ||
        src.number ||
        src.caller ||
        '';
    const rawMessage = src.messageContent ||
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
function resolveSmsDesiredDate(desiredDateISO) {
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
function processIncomingSmsToRequest(senderPhone, messageContent, options) {
    return __awaiter(this, void 0, void 0, function* () {
        yield ensureSmsSchemaColumnsAndGeminiKey();
        // 1단계: 스팸 / 광고 / 시스템 알림 문자 필터링
        const spamCheck = (0, smsAiParser_1.isObviousSpamOrSystemSms)(messageContent);
        if (spamCheck.isSpam) {
            return {
                registered: false,
                skippedReason: spamCheck.reason,
                analysis: null,
                normalizedAddress: null,
                request: null,
            };
        }
        const analysis = yield (0, smsAiParser_1.parseSmsContentWithAiOrFallback)(messageContent);
        // 2단계: 실제 공기계 웹훅 수신 시 최근 10분 내 동일 발신자의 연속 보충문자(예: 공동현관 비번, 물량 추가 전송) 자동 병합
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        if (!options.isSimulation &&
            options.saveToDb &&
            senderPhone &&
            senderPhone !== '010-0000-0000') {
            const recentSmsReq = yield prisma_1.prisma.request.findFirst({
                where: {
                    phone: senderPhone,
                    requestSource: 'SMS',
                    status: { in: ['PENDING', 'ASSIGNED'] },
                    createdAt: { gte: tenMinutesAgo },
                },
                orderBy: { createdAt: 'desc' },
                select: prisma_1.REQUEST_LIGHT_SELECT,
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
                const existingHasConfirmedAddr = Boolean(recentSmsReq.address) && !recentSmsReq.address.startsWith('[주소확인필요]');
                const newMsgHasOwnDistinctAddress = Boolean(analysis.isPickupRequest && analysis.rawAddress);
                if (!(existingHasConfirmedAddr && newMsgHasOwnDistinctAddress)) {
                    const mergedSmsText = `${recentSmsReq.rawSmsText || ''}\n[추가문자] ${messageContent}`.trim();
                    const followUpNormalized = analysis.rawAddress
                        ? yield (0, smsAiParser_1.normalizeAddressWithKakao)(analysis.rawAddress)
                        : null;
                    const updatedRequest = yield prisma_1.prisma.request.update({
                        where: { id: recentSmsReq.id },
                        data: {
                            rawSmsText: mergedSmsText,
                            address: (followUpNormalized === null || followUpNormalized === void 0 ? void 0 : followUpNormalized.isVerified)
                                ? followUpNormalized.standardAddress
                                : recentSmsReq.address,
                            detailAddress: analysis.detailAddress || recentSmsReq.detailAddress,
                            estimatedVolume: analysis.itemsSummary
                                ? `[문자신청] ${analysis.itemsSummary}`
                                : recentSmsReq.estimatedVolume,
                        },
                        select: prisma_1.REQUEST_LIGHT_SELECT,
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
            ? yield (0, smsAiParser_1.normalizeAddressWithKakao)(analysis.rawAddress)
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
        let province = (0, smsAiParser_1.standardizeProvinceName)((normalizedAddress === null || normalizedAddress === void 0 ? void 0 : normalizedAddress.province) || '');
        let city = (normalizedAddress === null || normalizedAddress === void 0 ? void 0 : normalizedAddress.city) || '';
        if ((!province || !city) && analysis.rawAddress) {
            const parts = analysis.rawAddress.split(' ');
            province = (0, smsAiParser_1.standardizeProvinceName)(parts[0] || '');
            city = parts[1] || '';
        }
        let regionId = null;
        let partnerToNotify = null;
        if (province && city) {
            const baseCity = city.trim().split(' ')[0] || city.trim();
            const region = yield prisma_1.prisma.region.findFirst({
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
        const finalAddress = (normalizedAddress === null || normalizedAddress === void 0 ? void 0 : normalizedAddress.isVerified)
            ? normalizedAddress.standardAddress
            : analysis.rawAddress
                ? `[주소확인필요] ${analysis.rawAddress}`
                : '[주소확인필요]';
        const finalDetailAddress = analysis.detailAddress || '';
        const finalUserName = analysis.customerName ? `[문자] ${analysis.customerName}` : '💬 문자간편신청';
        const finalVolume = analysis.itemsSummary ? `[문자신청] ${analysis.itemsSummary}` : '문자 접수 (원문 확인)';
        // 6단계: 수거신청(Request) 테이블에 문자신청(requestSource: 'SMS')으로 자동 등록
        const newRequest = yield prisma_1.prisma.request.create({
            data: {
                userName: finalUserName,
                phone: senderPhone || '010-0000-0000',
                address: finalAddress,
                detailAddress: finalDetailAddress,
                zipCode: (normalizedAddress === null || normalizedAddress === void 0 ? void 0 : normalizedAddress.zipCode) || '00000',
                sigungu: (normalizedAddress === null || normalizedAddress === void 0 ? void 0 : normalizedAddress.city) || city || null,
                bname: (normalizedAddress === null || normalizedAddress === void 0 ? void 0 : normalizedAddress.town) || null,
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
            select: prisma_1.REQUEST_LIGHT_SELECT,
        });
        // 7단계: 담당 파트너 사장님께 신규 문자 신청 알림 발송 (비동기)
        if (partnerToNotify === null || partnerToNotify === void 0 ? void 0 : partnerToNotify.phone) {
            (0, notificationService_1.sendNewRequestToPartner)(partnerToNotify.phone, newRequest.userName, newRequest.address, partnerToNotify.useBizMessage).catch((err) => console.error('[SMS Webhook] 파트너 알림 발송 실패:', err));
        }
        return {
            registered: true,
            analysis,
            normalizedAddress,
            request: newRequest,
        };
    });
}
/**
 * [1] 010 안드로이드 공기계 전용 앱(allclear-app.apk) 및 외부 포워더 인바운드 웹훅
 * - GET과 POST를 모두 허용해 설정 실수로 인한 유실을 0%로 방지하며,
 * - 등록 즉시 Socket.IO 브로드캐스트를 발행해 사장님 PC 대시보드 화면을 새로고침 없이 자동 갱신합니다.
 */
function handleIncomingSmsWebhook(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        try {
            const configuredSecret = (process.env.SMS_WEBHOOK_SECRET || '').trim();
            if (configuredSecret) {
                const headerSecret = req.headers['x-webhook-secret'] ||
                    ((_b = (_a = req.headers.authorization) === null || _a === void 0 ? void 0 : _a.replace(/^Bearer\s+/i, '')) !== null && _b !== void 0 ? _b : '');
                const querySecret = String(req.query.secret || ((_c = req.body) === null || _c === void 0 ? void 0 : _c.secret) || '');
                if (headerSecret !== configuredSecret && querySecret !== configuredSecret) {
                    return res.status(401).json({ error: '유효하지 않은 SMS 웹훅 보안 키입니다.' });
                }
            }
            const { senderPhone, messageContent } = extractSmsPayload(req);
            if (!messageContent) {
                return res.status(400).json({ error: '문자 본문(messageContent / text)이 비어 있습니다.' });
            }
            const result = yield processIncomingSmsToRequest(senderPhone, messageContent, {
                saveToDb: true,
            });
            if (result.registered) {
                try {
                    (0, socket_1.getIo)().emit('requests_reordered');
                }
                catch (_d) {
                    // 소켓 초기화 전 호출 시 안전 무시
                }
            }
            return res.status(result.registered ? 201 : 200).json(Object.assign({ success: true }, result));
        }
        catch (error) {
            console.error('[SMS Webhook Error] 문자 자동 접수 처리 중 오류:', error);
            return res.status(500).json({ error: '문자 자동 접수 처리 중 서버 오류가 발생했습니다.' });
        }
    });
}
router.get('/webhook', handleIncomingSmsWebhook);
router.post('/webhook', handleIncomingSmsWebhook);
/**
 * [1-B] 올클 전용 안드로이드 앱(allclear-app.apk) '1초 서버 연결 확인' 엔드포인트
 */
router.get('/ping', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const configuredSecret = (process.env.SMS_WEBHOOK_SECRET || '').trim();
    const providedSecret = String(req.headers['x-webhook-secret'] || req.query.secret || '').trim();
    const secretValid = !configuredSecret || providedSecret === configuredSecret;
    const representativePhone = yield (0, representativePhoneService_1.getRepresentativePhone)();
    return res.status(secretValid ? 200 : 401).json({
        ok: secretValid,
        secretValid,
        representativePhone,
        serverTime: new Date().toISOString(),
        message: secretValid
            ? `올클 서버 연결 정상${representativePhone ? ` (대표번호: ${representativePhone})` : ''}`
            : '서버 통신은 성공했으나 웹훅 보안키가 일치하지 않습니다.',
    });
}));
/**
 * [1-C] 사무실 010 대표번호 공기계 전용 문자 자동접수 APK 다운로드
 * GET /api/sms/apk
 */
router.get('/apk', (_req, res) => {
    const candidatePaths = [
        node_path_1.default.resolve(__dirname, '../../public/downloads/allclear-app.apk'),
        node_path_1.default.resolve(process.cwd(), 'public/downloads/allclear-app.apk'),
        node_path_1.default.resolve(__dirname, '../../../frontend/public/downloads/allclear-app.apk'),
        node_path_1.default.resolve(__dirname, '../../../android-app/dist/allclear-app.apk'),
        node_path_1.default.resolve(process.cwd(), '../frontend/public/downloads/allclear-app.apk'),
    ];
    const foundApk = candidatePaths.find((p) => node_fs_1.default.existsSync(p));
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
router.get('/config', authMiddleware_1.authenticate, (0, authMiddleware_1.requireRole)(['PARTNER', 'SUPER_ADMIN']), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    yield ensureSmsSchemaColumnsAndGeminiKey();
    const geminiKey = (process.env.GEMINI_API_KEY || '').trim();
    const openAiKey = (process.env.OPENAI_API_KEY || '').trim();
    const health = (0, smsAiParser_1.getSmsAiRuntimeHealth)();
    let activeAnalyzer = 'REGEX_FALLBACK';
    let aiStatusWarning = null;
    if (geminiKey && !geminiKey.startsWith('your_')) {
        if (health.lastGeminiRuntimeError) {
            activeAnalyzer = 'REGEX_FALLBACK';
            aiStatusWarning = health.lastGeminiRuntimeError;
        }
        else {
            activeAnalyzer = 'GEMINI';
        }
    }
    else if (openAiKey && !openAiKey.startsWith('your_')) {
        if (health.lastOpenAiRuntimeError) {
            activeAnalyzer = 'REGEX_FALLBACK';
            aiStatusWarning = health.lastOpenAiRuntimeError;
        }
        else {
            activeAnalyzer = 'OPENAI';
        }
    }
    const secret = (process.env.SMS_WEBHOOK_SECRET || 'allclear-sms-secret-2026').trim();
    const representativePhone = yield (0, representativePhoneService_1.getRepresentativePhone)();
    const kakaoConfigured = Boolean(process.env.KAKAO_CLIENT_ID) &&
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
        sampleJsonPayload: JSON.stringify({
            from: '%from%',
            text: '%text%',
        }, null, 2),
    });
}));
/**
 * [2-B] 슈퍼관리자 전용 Gemini API 키 런타임 등록 및 DB 영구 저장 엔드포인트
 * POST /api/sms/gemini-key
 */
router.post('/gemini-key', authMiddleware_1.authenticate, (0, authMiddleware_1.requireRole)(['SUPER_ADMIN']), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        yield ensureSmsSchemaColumnsAndGeminiKey();
        const rawKey = String(((_a = req.body) === null || _a === void 0 ? void 0 : _a.geminiApiKey) || '').trim();
        process.env.GEMINI_API_KEY = rawKey;
        (0, smsAiParser_1.resetSmsAiRuntimeErrors)();
        yield prisma_1.prisma.globalSettings.upsert({
            where: { id: 'global' },
            update: {},
            create: { id: 'global' },
        });
        yield prisma_1.prisma.$executeRaw `UPDATE "GlobalSettings" SET "geminiApiKey" = ${rawKey || null} WHERE "id" = 'global'`;
        try {
            const envPath = node_path_1.default.resolve(__dirname, '../../.env');
            if (node_fs_1.default.existsSync(envPath)) {
                let envContent = node_fs_1.default.readFileSync(envPath, 'utf8');
                if (/^GEMINI_API_KEY=/m.test(envContent)) {
                    envContent = envContent.replace(/^GEMINI_API_KEY=.*$/m, `GEMINI_API_KEY=${rawKey}`);
                }
                else {
                    envContent = `${envContent.trimEnd()}\nGEMINI_API_KEY=${rawKey}\n`;
                }
                node_fs_1.default.writeFileSync(envPath, envContent, 'utf8');
            }
        }
        catch (_b) {
            // 읽기 전용 컨테이너 파일시스템에서는 안전하게 무시 (DB에 이미 영구 저장됨)
        }
        return res.json({
            success: true,
            hasGeminiKey: Boolean(rawKey),
            message: rawKey
                ? 'Google Gemini AI 키가 DB에 영구 저장되어 즉시 활성화되었습니다.'
                : 'Gemini AI 키가 해제되어 내장 한국어 파서 모드로 전환되었습니다.',
        });
    }
    catch (error) {
        console.error('[SMS Gemini Key Save Error]:', error);
        return res.status(500).json({ error: 'API 키 저장 중 오류가 발생했습니다.' });
    }
}));
/**
 * [3] 관리자 대시보드용: 문자 AI 인식 미리보기 & 테스트 접수 시뮬레이터
 * POST /api/sms/simulate
 */
router.post('/simulate', authMiddleware_1.authenticate, (0, authMiddleware_1.requireRole)(['PARTNER', 'SUPER_ADMIN']), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { senderPhone, messageContent, saveToDb = false } = req.body;
        if (!messageContent || String(messageContent).trim().length === 0) {
            return res.status(400).json({ error: '테스트할 문자 내용을 입력해 주세요.' });
        }
        const formattedPhone = normalizeKoreanPhone(String(senderPhone || '010-1234-5678'));
        const result = yield processIncomingSmsToRequest(formattedPhone, String(messageContent).trim(), {
            saveToDb: Boolean(saveToDb),
            isSimulation: true,
        });
        if (result.registered) {
            try {
                (0, socket_1.getIo)().emit('requests_reordered');
            }
            catch (_a) {
                // 무시
            }
        }
        return res.status(result.registered ? 201 : 200).json(Object.assign({ success: true }, result));
    }
    catch (error) {
        console.error('[SMS Simulate Error]:', error);
        return res.status(500).json({ error: '문자 시뮬레이션 처리 중 오류가 발생했습니다.' });
    }
}));
exports.default = router;
