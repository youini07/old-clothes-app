/**
 * 웹앱(PWA) 설치 프롬프트 제어 및 기기·브라우저 환경 감지 유틸리티
 *
 * [왜 별도 유틸리티로 분리했는가]
 * 안드로이드 크롬/엣지(beforeinstallprompt 자동 설치), 아이폰 사파리(공유 -> 홈 화면에 추가),
 * 카카오톡·네이버 인앱 브라우저(외부 크롬 강제 전환 필요), PC 데스크탑 등 기기마다 다른
 * 설치 절차를 일관되게 감지해 초보자도 막힘없이 앱 아이콘을 생성하도록 돕기 위함입니다.
 */

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

declare global {
  interface Window {
    __allclearDeferredPrompt?: BeforeInstallPromptEvent | null;
  }
}

export const PWA_PREFERRED_ENTRY_KEY = 'allclear_pwa_preferred_entry';

export type PwaTargetRole = 'customer' | 'staff' | 'admin' | 'driver' | 'super-admin';

export interface PwaEnvironmentInfo {
  isStandalone: boolean;
  isInAppBrowser: boolean;
  isAndroid: boolean;
  isIos: boolean;
  isSamsungInternet: boolean;
  isDesktop: boolean;
}

export function detectPwaEnvironment(): PwaEnvironmentInfo {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      isStandalone: false,
      isInAppBrowser: false,
      isAndroid: false,
      isIos: false,
      isSamsungInternet: false,
      isDesktop: true,
    };
  }

  const ua = navigator.userAgent || '';
  const isDisplayStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: window-controls-overlay)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;

  const isIos =
    /iPad|iPhone|iPod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isInAppBrowser = /KAKAOTALK|NAVER|Instagram|BAND|FBAN|FBAV|Line|DaumApps/i.test(ua);
  const isSamsungInternet = /SamsungBrowser/i.test(ua);

  return {
    isStandalone: isDisplayStandalone,
    isInAppBrowser,
    isAndroid,
    isIos,
    isSamsungInternet,
    isDesktop: !isAndroid && !isIos,
  };
}

export function resolveTargetEntryPath(role: PwaTargetRole): string {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'driver':
      return '/driver';
    case 'super-admin':
      return '/super-admin';
    case 'staff':
      return '/staff-login';
    case 'customer':
    default:
      return '/';
  }
}

export function savePreferredPwaEntry(role: PwaTargetRole): string {
  const path = resolveTargetEntryPath(role);
  try {
    localStorage.setItem(PWA_PREFERRED_ENTRY_KEY, path);
  } catch {
    // 스토리지 제한 환경 안전 무시
  }
  return path;
}

export function openCurrentPageInAndroidChrome(targetPath?: string): void {
  if (typeof window === 'undefined') return;
  const targetUrl = targetPath
    ? `${window.location.origin}${targetPath}`
    : window.location.href;
  const scheme = window.location.protocol.replace(':', '') || 'https';
  const urlWithoutScheme = targetUrl.replace(/^https?:\/\//i, '');
  const intentUrl = `intent://${urlWithoutScheme}#Intent;scheme=${scheme};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(
    targetUrl
  )};end`;
  window.location.href = intentUrl;
}
