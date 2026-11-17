import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  MonitorSmartphone,
  Share,
  X,
} from 'lucide-react';
import {
  type BeforeInstallPromptEvent,
  detectPwaEnvironment,
  openCurrentPageInAndroidChrome,
  type PwaTargetRole,
  resolveTargetEntryPath,
  savePreferredPwaEntry,
} from '../utils/pwaInstall';

interface PwaInstallButtonProps {
  role?: PwaTargetRole;
  variant?: 'header-compact' | 'settings-card';
  label?: string;
  hideWhenInstalled?: boolean;
  className?: string;
}

/**
 * 전 기기(Android·iPhone·PC·인앱 브라우저) 통합 올클 웹앱(PWA) 저장 버튼 및 맞춤 안내 모달
 */
export default function PwaInstallButton({
  role = 'admin',
  variant = 'settings-card',
  label,
  hideWhenInstalled = false,
  className = '',
}: PwaInstallButtonProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() =>
    typeof window !== 'undefined' ? window.__allclearDeferredPrompt || null : null
  );
  const [env, setEnv] = useState(() => detectPwaEnvironment());
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      window.__allclearDeferredPrompt = promptEvent;
      setDeferredPrompt(promptEvent);
    };

    const handleInstalled = () => {
      window.__allclearDeferredPrompt = null;
      setDeferredPrompt(null);
      setJustInstalled(true);
      setIsGuideOpen(false);
      setEnv(detectPwaEnvironment());
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const isInstalled = env.isStandalone || justInstalled;
  if (isInstalled && hideWhenInstalled) {
    return null;
  }

  const appDisplayName = role === 'customer' ? '올클 웹앱' : '올클 관리 콘솔 앱';
  const targetPath = resolveTargetEntryPath(role);
  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${targetPath}`
      : `https://www.all-cle.com${targetPath}`;

  const handleInstallClick = async () => {
    savePreferredPwaEntry(role);
    const activePrompt = deferredPrompt || window.__allclearDeferredPrompt || null;

    if (activePrompt) {
      try {
        await activePrompt.prompt();
        const choice = await activePrompt.userChoice;
        if (choice.outcome === 'accepted') {
          window.__allclearDeferredPrompt = null;
          setDeferredPrompt(null);
          setJustInstalled(true);
        }
        return;
      } catch {
        // 수동 가이드 폴백
      }
    }

    setEnv(detectPwaEnvironment());
    setIsGuideOpen(true);
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      alert(`주소: ${shareUrl}`);
    }
  };

  const renderGuideModal = () => {
    if (!isGuideOpen || typeof document === 'undefined') return null;

    return createPortal(
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/55 backdrop-blur-[2px] p-4"
        onClick={() => setIsGuideOpen(false)}
      >
        <div
          role="dialog"
          aria-modal="true"
          className="w-full max-w-md rounded-2xl bg-white border border-gray-200 shadow-2xl overflow-hidden text-gray-900"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-5 py-4 bg-blue-700 text-white flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-white/15 border border-white/25 flex items-center justify-center shrink-0 text-xs font-black tracking-tight text-white">
                AC
              </div>
              <div className="min-w-0">
                <h2 className="text-sm sm:text-base font-bold truncate">
                  {appDisplayName} 바탕화면·홈화면 저장
                </h2>
                <p className="text-[11px] text-blue-100 truncate">
                  앱스토어 설치 없이 아이콘 하나로 바로 실행됩니다
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsGuideOpen(false)}
              aria-label="안내창 닫기"
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 space-y-4 text-xs sm:text-sm leading-relaxed">
            {isInstalled ? (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 font-semibold flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>현재 이미 설치된 앱 화면으로 접속 중입니다.</span>
              </div>
            ) : env.isInAppBrowser && env.isAndroid ? (
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950">
                  <p className="font-bold mb-1">카카오톡·밴드 등 인앱 브라우저 접속 안내</p>
                  <p className="text-xs text-amber-900">
                    메신저 내부 브라우저에서는 홈화면 앱 저장이 제한됩니다. 아래 버튼을 눌러{' '}
                    <strong>Chrome 브라우저</strong>로 열면 즉시 웹앱으로 저장하실 수 있습니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openCurrentPageInAndroidChrome(targetPath)}
                  className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Chrome 브라우저로 바로 열어서 저장하기</span>
                </button>
              </div>
            ) : env.isIos ? (
              <div className="space-y-3">
                <p className="text-gray-700 font-medium">
                  아이폰·아이패드(Safari)에서는 아래 <strong>2단계</strong>로 홈 화면에 앱을 저장할 수 있습니다.
                </p>
                <ol className="space-y-2.5 bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs sm:text-[13px] text-gray-800">
                  <li>
                    <strong>1단계.</strong> 브라우저 하단(또는 상단)의{' '}
                    <strong className="inline-flex items-center gap-0.5 text-blue-600">
                      <Share className="w-3.5 h-3.5 inline" /> 공유 버튼
                    </strong>
                    을 터치합니다.
                  </li>
                  <li>
                    <strong>2단계.</strong> 메뉴에서 <strong>[홈 화면에 추가] → [추가]</strong>를 누르면 바탕화면에 아이콘이 생성됩니다.
                  </li>
                </ol>
              </div>
            ) : env.isAndroid ? (
              <div className="space-y-3">
                <p className="text-gray-700 font-medium">
                  안드로이드(갤럭시) 스마트폰 홈 화면 앱 설치 방법:
                </p>
                <ol className="space-y-2.5 bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs sm:text-[13px] text-gray-800">
                  <li>
                    <strong>1단계.</strong> 브라우저 우측 상단 <strong>[⋮] 메뉴</strong>를 터치합니다.
                  </li>
                  <li>
                    <strong>2단계.</strong> <strong>[홈 화면에 추가] → [설치]</strong>를 누르면 휴대폰 바탕화면에 아이콘이 생성됩니다.
                  </li>
                </ol>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-gray-700 font-medium">
                  PC(크롬 · 엣지 · 웨일) 바탕화면 및 작업표시줄 앱 설치 방법:
                </p>
                <ol className="space-y-2.5 bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs sm:text-[13px] text-gray-800">
                  <li>
                    <strong>방법 A (가장 빠름):</strong> 브라우저 주소창 오른쪽 끝에 있는{' '}
                    <strong className="text-blue-600">[앱 설치] 아이콘</strong>을 클릭하고 <strong>[설치]</strong>를 누릅니다.
                  </li>
                  <li>
                    <strong>방법 B:</strong> 브라우저 우측 상단 <strong>[⋮] 메뉴 → [전송, 저장, 공유] → [페이지를 앱으로 설치...]</strong>를 클릭합니다.
                  </li>
                </ol>
              </div>
            )}

            <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleCopyUrl}
                className="h-9 px-3 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-xs font-semibold text-gray-700 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedUrl ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">주소 복사됨</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-gray-500" />
                    <span>접속 주소 복사</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setIsGuideOpen(false)}
                className="h-9 px-4 rounded-lg bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  if (variant === 'settings-card') {
    return (
      <>
        <div
          className={`p-4 rounded-2xl bg-blue-50/70 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${className}`}
        >
          <div className="space-y-1 min-w-0">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[11px] font-bold">
              <MonitorSmartphone className="w-3 h-3" />
              <span>아이폰 · 갤럭시 · 태블릿 · PC 겸용</span>
            </div>
            <h3 className="text-sm sm:text-base font-bold text-gray-900">
              사장님 배차 콘솔 웹앱(바탕화면·홈화면) 저장
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              매번 브라우저 주소를 입력할 필요 없이 휴대폰 홈화면이나 사무실 PC 바탕화면에 전용 앱 아이콘을 만들어 1초 만에 실행합니다.
            </p>
          </div>

          {isInstalled ? (
            <span className="h-10 px-3.5 rounded-xl bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold inline-flex items-center justify-center gap-1.5 shrink-0">
              <Check className="w-4 h-4" />
              <span>현재 웹앱으로 실행 중</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={handleInstallClick}
              className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 shrink-0 transition-colors cursor-pointer shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span>{label || '웹앱 바로 저장하기'}</span>
            </button>
          )}
        </div>
        {renderGuideModal()}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        className={`h-8 px-2.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap transition-colors cursor-pointer ${className}`}
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span>{label || '앱저장'}</span>
      </button>
      {renderGuideModal()}
    </>
  );
}
