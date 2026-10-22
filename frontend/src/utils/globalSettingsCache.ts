import axios from 'axios';

// 왜: 랜딩 페이지 진입 시 GlobalNoticeBanner, GlobalPopupBanner, Landing 3개 컴포넌트가 동시에 마운트되며
// Base64 팝업 이미지가 포함될 수 있는 /public/global-settings를 3번 중복 호출하는 문제를 방지하기 위해
// 진행 중인 Promise 공유(In-flight Deduplication) 및 짧은 메모리 캐시(30초 TTL)를 적용함
let cachedData: any = null;
let cachedAt = 0;
let inFlightPromise: Promise<any> | null = null;
let cacheBustToken = 0;
const CACHE_TTL_MS = 30 * 1000;

export function invalidateGlobalSettingsCache() {
  cachedData = null;
  cachedAt = 0;
  inFlightPromise = null;
  // 왜: 백엔드가 Cache-Control: public, max-age=60을 반환하므로 관리자 설정 변경 직후에는
  // 브라우저 HTTP 캐시를 우회하여 최신 설정을 즉시 가져오도록 캐시 버스팅 토큰을 갱신함
  cacheBustToken = Date.now();
}

export async function getGlobalSettingsCached(forceRefresh = false): Promise<any> {
  const now = Date.now();
  if (forceRefresh) {
    cachedData = null;
    cachedAt = 0;
    cacheBustToken = now;
  }

  if (!forceRefresh && cachedData && now - cachedAt < CACHE_TTL_MS) {
    return cachedData;
  }

  if (!forceRefresh && inFlightPromise) {
    return inFlightPromise;
  }

  const baseUrl = `${import.meta.env.VITE_API_URL}/public/global-settings`;
  const url = cacheBustToken > 0 ? `${baseUrl}?v=${cacheBustToken}` : baseUrl;

  inFlightPromise = axios
    .get(url)
    .then((res) => {
      cachedData = res.data;
      cachedAt = Date.now();
      inFlightPromise = null;
      return cachedData;
    })
    .catch((err) => {
      inFlightPromise = null;
      throw err;
    });

  return inFlightPromise;
}

