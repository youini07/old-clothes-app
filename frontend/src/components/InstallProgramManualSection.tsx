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
import { resolveApiBaseUrl, resolveServerRootUrl } from '../utils/apiUrl';

interface InstallProgramManualSectionProps {
  onOpenSmsModal?: () => void;
}

/**
 * 사무실 대표번호 공기계 문자 자동접수 프로그램(allclear-app.apk) 다운로드 및 설치 매뉴얼 카드
 *
 * [왜 중첩 테두리 박스를 제거하고 단일 카드 규격으로 변경했는가]
 * 기존에는 외부 흰색 컨테이너 안에 또 다른 회색 박스와 파란 박스가 겹겹이 중첩되어 시선이 분산되었으므로,
 * 2열 그리드의 좌측 열에 깔끔하게 안착하는 단일 플랫 카드로 정돈했습니다.
 */
export default function InstallProgramManualSection({
  onOpenSmsModal,
}: InstallProgramManualSectionProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [openOfficeManual, setOpenOfficeManual] = useState(true);
  const [showQr, setShowQr] = useState(false);

  const apiBase = resolveApiBaseUrl();
  const serverRootUrl = resolveServerRootUrl();

  const webOrigin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://www.all-cle.com';

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
    <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
            <Smartphone className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900">
              사무실 문자 자동접수 앱 (allclear-app.apk)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              010 대표번호 공기계에 설치해 켜두면 고객 수거신청 문자(장문 LMS 포함)가 대시보드에 실시간 자동 접수됩니다.
            </p>
          </div>
        </div>
      </div>

      {/* 핵심 액션 버튼 그룹 */}
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
        <a
          href="/downloads/allclear-app.apk"
          download="allclear-app.apk"
          className="h-9 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 shadow-xs transition-colors"
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span>전용 앱 다운로드</span>
        </a>

        <button
          type="button"
          onClick={() => setShowQr((v) => !v)}
          className="h-9 px-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
        >
          <QrCode className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span>{showQr ? 'QR코드 닫기' : 'QR 스캔 설치'}</span>
        </button>

        <button
          type="button"
          onClick={() => handleCopy(shareableOfficeApkUrl, 'OFFICE_LINK')}
          className="h-9 px-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
        >
          {copiedKey === 'OFFICE_LINK' ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>설치링크 복사됨</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>설치링크 복사</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleCopy(serverRootUrl, 'BOSS_SERVER')}
          className="h-9 px-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
        >
          {copiedKey === 'BOSS_SERVER' ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>서버주소 복사됨</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>서버주소 복사</span>
            </>
          )}
        </button>
      </div>

      {onOpenSmsModal && (
        <button
          type="button"
          onClick={onOpenSmsModal}
          className="w-full h-9 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span>문자 주소 인식 시뮬레이터 & 외부 웹훅(Webhook) 설정 열기</span>
        </button>
      )}

      {showQr && (
        <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 rounded-xl p-3.5">
          <div className="p-2 bg-white border border-slate-200 rounded-lg shrink-0">
            <QRCodeSVG value={shareableOfficeApkUrl} size={96} level="M" />
          </div>
          <div className="space-y-1 text-xs text-slate-700 min-w-0">
            <p className="font-bold text-slate-900">
              갤럭시 공기계 기본 카메라로 스캔하세요
            </p>
            <p className="leading-relaxed text-slate-600">
              화면에 뜨는 주소를 터치하면 <code className="px-1 bg-white border border-slate-200 rounded font-mono text-[11px]">allclear-app.apk</code>가 바로 다운로드됩니다.
            </p>
            <p className="text-[11px] text-slate-400 truncate">{shareableOfficeApkUrl}</p>
          </div>
        </div>
      )}

      {/* 4단계 설치 가이드 */}
      <div className="pt-3 border-t border-slate-100">
        <button
          type="button"
          onClick={() => setOpenOfficeManual((v) => !v)}
          className="w-full flex items-center justify-between text-xs font-bold text-slate-800 py-0.5 cursor-pointer"
        >
          <span>갤럭시 공기계 설치 순서 (4단계 · 최초 1회)</span>
          {openOfficeManual ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>
        {openOfficeManual && (
          <ol className="mt-2.5 space-y-2 text-xs text-slate-600 leading-relaxed bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80">
            <li>
              <strong className="text-slate-900">1단계:</strong> 공기계 <strong>설정 → 보안 및 개인정보 보호 → 보안 위험 자동 차단 → OFF</strong>
            </li>
            <li>
              <strong className="text-slate-900">2단계:</strong> 다운로드한{' '}
              <code className="px-1 bg-white border border-slate-200 rounded font-mono text-[11px]">allclear-app.apk</code> 실행 → <strong>무시하고 설치</strong>
            </li>
            <li>
              <strong className="text-slate-900">3단계:</strong> 문자 권한이 잠겨 있으면 <strong>애플리케이션 → 올클 문자자동접수 → 우측 상단 [⋮] → 제한된 설정 허용</strong> 후 SMS 허용
            </li>
            <li>
              <strong className="text-slate-900">4단계:</strong> 앱 실행 → 정식 서버 주소 자동입력 확인 → <strong>[문자 권한 허용 & 자동접수 시작 (ON)]</strong> 터치
            </li>
          </ol>
        )}
      </div>
    </section>
  );
}
