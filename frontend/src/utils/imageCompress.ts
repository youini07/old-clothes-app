/**
 * 홈페이지 치킨 이벤트 당첨자 인증샷 업로드용 이미지 최적화 유틸리티
 * 왜 별도 압축을 수행하는가:
 * - 모바일 카카오톡/기프티콘 캡처 원본은 1~5MB에 달해 여러 장을 그대로 DB에 저장하면
 *   랜딩 페이지 초기 로딩 속도와 서버 네트워크 전송량(Egress)이 급증합니다.
 * - 가독성(상품명/전송 메시지)을 해치지 않는 해상도(최대 1080x1600)와 WebP/JPEG 압축을 적용해
 *   장당 60~180KB 수준으로 경량화합니다.
 */

export const MAX_EVENT_PROOF_IMAGES = 10;
const MAX_SOURCE_FILE_BYTES = 15 * 1024 * 1024; // 15MB
const MAX_TARGET_BASE64_LENGTH = 550_000; // Base64 기준 약 400KB 상한 목표

/**
 * 이미지 파일을 로드해 비율을 유지하며 리사이징 및 압축된 Data URL로 변환합니다.
 */
export function compressEventProofImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
      reject(new Error('PNG, JPG, WEBP 등 일반 이미지 파일만 첨부할 수 있습니다.'));
      return;
    }
    if (file.size > MAX_SOURCE_FILE_BYTES) {
      reject(new Error('파일 크기가 15MB를 초과합니다. 더 작은 이미지를 선택해주세요.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result;
      if (typeof dataUrl !== 'string') {
        reject(new Error('이미지 데이터를 읽지 못했습니다.'));
        return;
      }

      const img = new Image();
      img.onload = () => {
        const maxWidth = 1080;
        const maxHeight = 1600;
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (!width || !height) {
          reject(new Error('올바르지 않은 이미지 크기입니다.'));
          return;
        }

        // 폭/높이 상한을 모두 만족하도록 비율 유지 축소 (작은 이미지는 확대하지 않음)
        const scale = Math.min(1, maxWidth / width, maxHeight / height);
        width = Math.max(1, Math.round(width * scale));
        height = Math.max(1, Math.round(height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('이미지 변환용 캔버스를 생성할 수 없습니다.'));
          return;
        }

        // 투명 PNG가 JPEG로 변환될 때 검은 배경이 되는 현상 방지
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // WebP 지원 브라우저에서는 더 작고 선명한 WebP 우선 사용, 미지원 시 JPEG 폴백
        const encodeWithFallback = (quality: number): string => {
          const webp = canvas.toDataURL('image/webp', quality);
          if (webp.startsWith('data:image/webp')) {
            return webp;
          }
          return canvas.toDataURL('image/jpeg', quality);
        };

        let result = encodeWithFallback(0.84);
        if (result.length > MAX_TARGET_BASE64_LENGTH) {
          result = encodeWithFallback(0.7);
        }
        if (result.length > MAX_TARGET_BASE64_LENGTH) {
          result = encodeWithFallback(0.55);
        }

        resolve(result);
      };
      img.onerror = () => reject(new Error('이미지를 불러오는 중 오류가 발생했습니다.'));
      img.src = dataUrl;
    };
    reader.onerror = () => reject(new Error('파일을 읽는 중 오류가 발생했습니다.'));
    reader.readAsDataURL(file);
  });
}
