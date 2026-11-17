import { useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  QrCode,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import PwaInstallButton from './PwaInstallButton';
import { resolveApiBaseUrl, resolveServerRootUrl } from '../utils/apiUrl';

interface InstallProgramManualSectionProps {
  onOpenSmsModal?: () => void;
}

/**
 * 사무실 대표번호 공기계 문자 자동접수 프로그램(allclear-app.apk) 다운로드 및 설치 매뉴얼 섹션
 *
 * [왜 환경 설정 상단에 QR코드 + 원클릭 다운로드 + 4단계 매뉴얼을 함께 배치하는가]
 * 사무실 PC에서 설정 화면을 열어둔 채 안드로이드 공기계 기본 카메라로 QR코드만 비추면
 * 카카오톡/문자로 링크를 전달할 필요 없이 즉시 전용 앱(allclear-app.apk)을 내려받아 설치할 수 있기 때문입니다.
 */
export default function InstallProgramManualSection({
  onOpenSmsModal,
}: InstallProgramManualSectionProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [openOfficeManual, setOpenOfficeManual] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const apiBase = resolveApiBaseUrl();
  const serverRootUrl = resolveServerRootUrl();

  const webOrigin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://www.all-cle.com';

  // 백엔드 직접 다운로드 경로 및 프론트엔드 정적 배포 경로(공유·QR 스캔용)
  const officeApkDownloadUrl = `${apiBase}/sms/apk`;
  const shareableOfficeApkUrl =
    webOrigin.includes('localhost') || webOrigin.includes('127.0.0.1')
      ? officeApkDownloadUrl
      : `${webOrigin}/downloads/allclear-app.apk`;

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      alert(text);
    }
  };

  return (
    <section className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-4">
      <PwaInstallButton role="admin" variant="settings-card" hideWhenInstalled={false} />

      {/* 사무실 공기계 문자 자동접수 전용 APK 카드 */}
      <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Smartphone className="w-5 h-5 text-blue-600 shrink-0" />
            <div>
              <h3 className="text-sm sm:text-base font-bold text-gray-900">
                사무실 문자 자동접수 전용 앱 (allclear-app.apk)
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                010 대표번호 공기계에 설치해 켜두면 고객 수거신청 문자(장문 LMS 포함)가 대시보드에 실시간 자동 접수됩니다.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleCopy(serverRootUrl, 'BOSS_SERVER')}
            className="h-8 px-3 rounded-lg bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            {copiedKey === 'BOSS_SERVER' ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>서버 주소 복사됨</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>서버 주소 복사</span>
              </>
            )}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/downloads/allclear-app.apk"
            download="allclear-app.apk"
            className="h-9 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>전용 앱(.apk) 다운로드</span>
          </a>

          <button
            type="button"
            onClick={() => setShowQr((v) => !v)}
            className="h-9 px-3 rounded-xl bg-white hover:bg-gray-100 border border-gray-300 text-gray-800 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <QrCode className="w-3.5 h-3.5 text-blue-600" />
            <span>{showQr ? 'QR코드 닫기' : '공기계 카메라 QR 설치'}</span>
          </button>

          <button
            type="button"
            onClick={() => handleCopy(shareableOfficeApkUrl, 'OFFICE_LINK')}
            className="h-9 px-3 rounded-xl bg-white hover:bg-gray-100 border border-gray-300 text-gray-800 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            {copiedKey === 'OFFICE_LINK' ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>설치 링크 복사됨</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>설치 링크 복사</span>
              </>
            )}
          </button>

          {onOpenSmsModal && (
            <button
              type="button"
              onClick={onOpenSmsModal}
              className="h-9 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>문자 인식 테스트 · 웹훅 보기</span>
            </button>
          )}
        </div>

        {showQr && (
          <div className="flex flex-col sm:flex-row items-center gap-4 bg-white border border-blue-100 rounded-xl p-4">
            <div className="p-2.5 bg-white border border-gray-200 rounded-xl shrink-0">
              <QRCodeSVG value={shareableOfficeApkUrl} size={112} level="M" />
            </div>
            <div className="space-y-1 text-xs text-gray-700">
              <p className="font-bold text-gray-900 text-sm">
                📱 갤럭시 공기계 기본 카메라로 위 QR코드를 비춰주세요!
              </p>
              <p className="leading-relaxed">
                화면에 뜨는 링크를 터치하면 <code className="px-1 py-0.5 bg-gray-100 rounded font-mono">allclear-app.apk</code> 파일이 즉시 다운로드됩니다.
              </p>
              <p className="text-[11px] text-gray-500 break-all">{shareableOfficeApkUrl}</p>
            </div>
          </div>
        )}

        <div className="pt-2.5 border-t border-gray-200/80">
          <button
            type="button"
            onClick={() => setOpenOfficeManual((v) => !v)}
            className="w-full flex items-center justify-between text-xs font-bold text-gray-800 py-0.5 cursor-pointer"
          >
            <span>갤럭시 공기계 초간편 설치 방법 보기 (4단계)</span>
            {openOfficeManual ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {openOfficeManual && (
            <ol className="mt-2.5 space-y-2 text-xs text-gray-700 leading-relaxed bg-white p-3.5 rounded-xl border border-gray-200">
              <li>
                <strong>1단계 (보안 차단 일시 해제):</strong> 갤럭시 공기계 <strong>설정 → 보안 및 개인정보 보호 → 보안 위험 자동 차단 → OFF</strong>로 변경합니다.
              </li>
              <li>
                <strong>2단계 (APK 설치):</strong> 다운로드한{' '}
                <code className="px-1 bg-gray-100 rounded font-mono text-[11px]">allclear-app.apk</code>를 실행한 뒤 <strong>무시하고 설치(더보기 → 무시하고 설치)</strong>를 누릅니다.
              </li>
              <li>
                <strong>3단계 (Android 13/14 문자 권한 허용):</strong> 문자 권한이 비활성화되어 있다면 휴대폰 <strong>설정 → 애플리케이션 → 올클 문자자동접수 → 우측 상단 [⋮] → 제한된 설정 허용</strong>을 누른 뒤 SMS 권한을 허용합니다.
              </li>
              <li>
                <strong>4단계 (자동수신 가동):</strong> 앱을 열고 서버 주소(<code className="px-1 bg-gray-100 rounded font-mono text-[11px]">{serverRootUrl}</code>)가 입력된 것을 확인한 뒤 <strong>[🟢 문자 권한 허용 & 자동접수 시작 (ON)]</strong> 버튼을 누르면 세팅이 완료됩니다!
              </li>
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}
