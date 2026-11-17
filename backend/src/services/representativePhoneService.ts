import { prisma } from '../lib/prisma';

/**
 * 대표 전화번호(홈페이지 상담 · 010 문자수거 수신 번호) 통합 관리 서비스
 *
 * [왜 별도 서비스로 분리했는가]
 * - 기존에는 전화번호가 환경변수(SENDER_PHONE 등)에만 고정되어 있어 사장님이 사무실 공기계 번호를 바꿀 때마다
 *   서버 환경변수를 수정하고 재배포해야 하는 번거로움이 있었습니다.
 * - DB(GlobalSettings 테이블)에 대표번호 컬럼을 무중단 자동 보장(ADD COLUMN IF NOT EXISTS)하여 저장하고,
 *   공개 설정 API·문자 웹훅 설정 API·관리자 설정 API가 모두 동일한 최신 번호를 참조하도록 일원화했습니다.
 */

let columnEnsured = false;

/**
 * 왜 하이픈 자동 포맷팅을 수행하는가:
 * 관리자가 숫자만 입력하더라도(예: 01012345678) 고객 랜딩 화면과 안내 모달에서
 * 읽기 편한 표준 하이픈 형식(010-1234-5678)으로 일관되게 노출하기 위함입니다.
 */
export function formatKoreanPhone(raw: string): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';

  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return trimmed;

  // 전국 대표번호 8자리 (예: 1588-1234, 1661-0000)
  if (digits.length === 8 && /^1\d{7}$/.test(digits)) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }

  // 서울 지역번호 (02)
  if (digits.startsWith('02')) {
    if (digits.length === 9) {
      return `02-${digits.slice(2, 5)}-${digits.slice(5)}`;
    }
    if (digits.length === 10) {
      return `02-${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
  }

  // 휴대폰(010 등) 및 일반 지역번호(031, 070 등)
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  return trimmed;
}

/**
 * 왜 런타임 ALTER TABLE IF NOT EXISTS를 사용하는가:
 * 로컬 개발 서버(npm run dev)나 클라우드 배포 직후 마이그레이션 타이밍 차이와 무관하게
 * 기존 운영 DB 데이터를 보존하면서 GlobalSettings.representativePhone 컬럼을 안전하게 보장하기 위함입니다.
 */
export async function ensureRepresentativePhoneColumn(): Promise<void> {
  if (columnEnsured) return;
  try {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "GlobalSettings" ADD COLUMN IF NOT EXISTS "representativePhone" TEXT;'
    );
    columnEnsured = true;
  } catch (error) {
    console.error('[representativePhoneService] 컬럼 보장 중 오류:', error);
  }
}

/**
 * 현재 운영 중인 올클 문자 자동접수 대표 전화번호를 조회합니다.
 *
 * [왜 파트너 개인 번호나 알리고 SENDER_PHONE을 자동 폴백하지 않는가]
 * 사무실 공기계에 전용 앱(allclear-app.apk)을 아직 설치하지 않은 상태에서 먼저 배포하더라도,
 * 준비되지 않은 번호로 고객 홈페이지에 [010 문자 접수] 버튼이 조기 노출되어 문자가 유실되는 사고를 원천 차단합니다.
 * 오직 사장님이 [환경 설정]에서 직접 입력·저장한 번호(또는 명시적 REPRESENTATIVE_PHONE 환경변수)만 활성화됩니다.
 */
export async function getRepresentativePhone(): Promise<string> {
  const rawEnv = (process.env.REPRESENTATIVE_PHONE || '').trim();
  const envFallback =
    rawEnv && !rawEnv.includes('등록된') && rawEnv !== '010-0000-0000'
      ? formatKoreanPhone(rawEnv)
      : '';

  try {
    await ensureRepresentativePhoneColumn();

    const rows = await prisma.$queryRawUnsafe<Array<{ representativePhone: string | null }>>(
      'SELECT "representativePhone" FROM "GlobalSettings" WHERE "id" = \'global\' LIMIT 1;'
    );
    const savedGlobalPhone = rows?.[0]?.representativePhone?.trim();
    if (savedGlobalPhone && savedGlobalPhone !== '010-0000-0000') {
      return formatKoreanPhone(savedGlobalPhone);
    }
  } catch (error) {
    console.error('[representativePhoneService] 대표번호 조회 실패, 환경변수 폴백 사용:', error);
  }

  return envFallback;
}

/**
 * 관리자 환경 설정 탭에서 변경한 대표 전화번호를 GlobalSettings에 저장합니다.
 */
export async function saveRepresentativePhone(rawPhone: string): Promise<string> {
  const formatted = formatKoreanPhone(rawPhone);

  await ensureRepresentativePhoneColumn();

  await prisma.globalSettings.upsert({
    where: { id: 'global' },
    update: {},
    create: {
      id: 'global',
      globalNotice: '',
      noticeIsActive: false,
      globalNoticeDetail: '',
    },
  });

  await prisma.$executeRawUnsafe(
    'UPDATE "GlobalSettings" SET "representativePhone" = $1, "updatedAt" = NOW() WHERE "id" = \'global\';',
    formatted || null
  );

  return formatted;
}
