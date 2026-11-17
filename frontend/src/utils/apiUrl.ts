/**
 * API 베이스 URL 및 실시간 소켓/APK 다운로드 루트 URL 해석 유틸리티
 *
 * [왜 별도 유틸리티로 분리했는가]
 * 1) 사무실 공유기·핫스팟 등 네트워크가 바뀔 때 로컬 개발 서버(:5000) 주소를 현재 브라우저 호스트 IP로 자동 치환하여
 *    같은 와이파이에 연결된 사무실 공기계에서도 설정 충돌 없이 즉시 백엔드에 접속할 수 있게 합니다.
 * 2) 정식 운영 환경(Railway 백엔드)에서는 정확한 루트 도메인(https://old-clothes-app-production.up.railway.app)을 반환합니다.
 */

const LOCAL_DEV_HOST_PORT_REGEX =
  /^http:\/\/(?:localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}):5000\b/i;

export function rewriteLocalDevUrl(rawUrl: string): string {
  if (!rawUrl) return rawUrl;
  if (typeof window === 'undefined' || !window.location?.hostname) {
    return rawUrl;
  }

  const currentHost = window.location.hostname;
  if (LOCAL_DEV_HOST_PORT_REGEX.test(rawUrl)) {
    return rawUrl.replace(LOCAL_DEV_HOST_PORT_REGEX, `http://${currentHost}:5000`);
  }
  return rawUrl;
}

/**
 * 백엔드 REST API 기본 주소(끝에 /api 포함)를 반환합니다.
 */
export function resolveApiBaseUrl(): string {
  const configured = String(import.meta.env.VITE_API_URL || 'http://localhost:5000/api')
    .trim()
    .replace(/\/+$/, '');
  const normalized = rewriteLocalDevUrl(configured);
  return normalized.endsWith('/api') ? normalized : `${normalized}/api`;
}

/**
 * Socket.IO 연결 및 안드로이드 앱 서버 주소 입력란에 사용할 백엔드 루트 주소(/api 제외)를 반환합니다.
 */
export function resolveServerRootUrl(): string {
  return resolveApiBaseUrl().replace(/\/api\/?$/, '');
}
