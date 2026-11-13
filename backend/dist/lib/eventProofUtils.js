"use strict";
/**
 * 치킨 이벤트 당첨자 기프티콘 전송 인증샷 설정 검증/정규화 유틸리티
 * 왜 별도 유틸로 분리하는가:
 * - 공개 API(/api/public/global-settings, /api/public/event-proof-images)와
 *   관리자 API(/api/admin/global-settings)가 동일한 데이터 정규화 및 보안 검증 규칙을 공유해야
 *   중복 로직과 잘못된 이미지 데이터(XSS 벡터 등) 저장을 막을 수 있기 때문입니다.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_EVENT_PROOF_IMAGES = void 0;
exports.isValidEventImageSrc = isValidEventImageSrc;
exports.normalizeEventProofImages = normalizeEventProofImages;
exports.validateEventProofImagesInput = validateEventProofImagesInput;
exports.normalizeEventProofTitle = normalizeEventProofTitle;
exports.MAX_EVENT_PROOF_IMAGES = 10;
const MAX_SINGLE_IMAGE_LENGTH = 1500000; // Base64 문자열 기준 약 1.5MB 상한 (프론트 압축 후 통상 60~200KB)
const MAX_TITLE_LENGTH = 60;
// SVG는 내부 스크립트 실행 위험이 있으므로 래스터 이미지 포맷만 허용합니다.
const SAFE_DATA_IMAGE_REGEX = /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/i;
/**
 * 이미지 소스 문자열이 안전한 URL 또는 허용된 래스터 Base64 Data URL인지 검증합니다.
 */
function isValidEventImageSrc(value) {
    if (typeof value !== 'string')
        return false;
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_SINGLE_IMAGE_LENGTH)
        return false;
    if (SAFE_DATA_IMAGE_REGEX.test(trimmed))
        return true;
    if (/^https?:\/\//i.test(trimmed))
        return true;
    // 동일 출처 상대 경로만 허용 (프로토콜 상대 URL '//' 차단)
    if (trimmed.startsWith('/') && !trimmed.startsWith('//'))
        return true;
    return false;
}
/**
 * DB JSON 필드에 저장된 인증샷 목록을 항상 안전한 string[] 형태로 정규화합니다.
 */
function normalizeEventProofImages(raw) {
    if (!Array.isArray(raw))
        return [];
    const normalized = [];
    for (const item of raw) {
        if (isValidEventImageSrc(item)) {
            normalized.push(item.trim());
            if (normalized.length >= exports.MAX_EVENT_PROOF_IMAGES)
                break;
        }
    }
    return normalized;
}
/**
 * 관리자 설정 저장 요청의 인증샷 배열을 검증합니다.
 */
function validateEventProofImagesInput(raw) {
    if (raw === null) {
        return { ok: true, images: [] };
    }
    if (!Array.isArray(raw)) {
        return { ok: false, error: '인증샷 목록 형식이 올바르지 않습니다.' };
    }
    if (raw.length > exports.MAX_EVENT_PROOF_IMAGES) {
        return { ok: false, error: `인증샷은 최대 ${exports.MAX_EVENT_PROOF_IMAGES}장까지 등록할 수 있습니다.` };
    }
    const images = [];
    for (const item of raw) {
        if (!isValidEventImageSrc(item)) {
            return {
                ok: false,
                error: '지원하지 않는 이미지 형식이거나 용량이 너무 큽니다. (PNG/JPG/WEBP/GIF만 가능)'
            };
        }
        images.push(item.trim());
    }
    return { ok: true, images };
}
/**
 * 인증샷 섹션 제목을 안전하게 정제합니다. (비어있으면 null 반환하여 프론트 기본 문구 사용)
 */
function normalizeEventProofTitle(raw) {
    if (typeof raw !== 'string')
        return null;
    const trimmed = raw.trim();
    if (!trimmed)
        return null;
    return trimmed.slice(0, MAX_TITLE_LENGTH);
}
