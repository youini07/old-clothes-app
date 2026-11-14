import axios from 'axios';

// 왜: 랜딩 페이지 진입 시 GlobalNoticeBanner, GlobalPopupBanner, Landing 3개 컴포넌트가 동시에 마운트되며
// Base64 팝업 이미지가 포함될 수 있는 /public/global-settings를 3번 중복 호출하는 문제를 방지하기 위해
// 진행 중인 Promise 공유(In-flight Deduplication) 및 짧은 메모리 캐시(30초 TTL)를 적용함
let cachedData: any = null;
let cachedAt = 0;
let inFlightPromise: Promise<any> | null = null;
let cacheBustToken = 0;
const CACHE_TTL_MS = 30 * 1000;
const CACHE_VERSION_STORAGE_KEY = 'global_settings_cache_v';

function getStoredCacheVersion(): number {
  try {
    const raw = localStorage.getItem(CACHE_VERSION_STORAGE_KEY);
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return 0;
  }
}

export function invalidateGlobalSettingsCache() {
  cachedData = null;
  cachedAt = 0;
  inFlightPromise = null;
  // 왜: 백엔드가 Cache-Control 헤더를 반환하므로 관리자 설정 변경 직후에는
  // 페이지 새로고침/탭 이동 시에도 브라우저 HTTP 캐시를 우회하도록 localStorage에 버스팅 토큰을 기록합니다.
  const nextVersion = Date.now();
  cacheBustToken = nextVersion;
  try {
    localStorage.setItem(CACHE_VERSION_STORAGE_KEY, String(nextVersion));
  } catch {
    // 스토리지 접근 불가 환경 무시
  }
}

export async function getGlobalSettingsCached(forceRefresh = false): Promise<any> {
  const now = Date.now();
  if (forceRefresh) {
    cachedData = null;
    cachedAt = 0;
    cacheBustToken = now;
    try {
      localStorage.setItem(CACHE_VERSION_STORAGE_KEY, String(now));
    } catch {
      // 무시
    }
  }

  if (!forceRefresh && cachedData && now - cachedAt < CACHE_TTL_MS) {
    return cachedData;
  }

  if (!forceRefresh && inFlightPromise) {
    return inFlightPromise;
  }

  const effectiveToken = Math.max(cacheBustToken, getStoredCacheVersion());
  const baseUrl = `${import.meta.env.VITE_API_URL}/public/global-settings`;
  const url = effectiveToken > 0 ? `${baseUrl}?v=${effectiveToken}` : baseUrl;

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

