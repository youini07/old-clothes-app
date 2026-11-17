import { useState } from 'react';
import { Check, Copy, MessageSquare, X } from 'lucide-react';

interface LandingSmsGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  representativePhone: string;
}

export function buildAllClearQuickSmsHref(representativePhone: string): string {
  const template =
    '[올클 헌옷수거 문자접수]\n도로명 상세주소(동·호수): \n공동현관 출입번호: \n예상물량(20kg 이상): \n수거희망일(비대면): ';
  return `sms:${representativePhone}?body=${encodeURIComponent(template)}`;
}

/**
 * 고객용 랜딩 페이지 010 간편 문자 수거신청 안내 모달
 *
 * [왜 별도 모달로 분리했는가]
 * 카카오톡 로그인이 익숙하지 않은 고객이나 어르신도 대표번호로 주소 문자 한 통만 보내면
 * 사무실 공기계 전용 앱(allclear-app.apk)이 이를 감지해 대시보드에 자동 등록하도록 연결하기 위함입니다.
 */
export default function LandingSmsGuideModal({
  isOpen,
  onClose,
  representativePhone,
}: LandingSmsGuideModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !representativePhone) return null;

  const quickSmsHref = buildAllClearQuickSmsHref(representativePhone);

  const handleCopyPhone = async () => {
    try {
      await navigator.clipboard.writeText(representativePhone);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert(`문자 접수 번호: ${representativePhone}`);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/55 backdrop-blur-[2px] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-md w-full max-h-[90dvh] overflow-y-auto p-6 shadow-2xl border border-gray-200 relative text-left"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="안내 창 닫기"
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-800 rounded-xl hover:bg-gray-100 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <p className="text-xs font-extrabold text-blue-600 mb-1">카카오톡 로그인 없이 간편 접수</p>
        <h3 className="text-xl font-black text-gray-900 mb-2">
          📩 010 간편 문자 수거신청 안내
        </h3>
        <p className="text-sm text-gray-600 leading-relaxed mb-4 break-keep">
          반드시 <strong className="text-gray-900">본인 휴대폰 번호</strong>로 아래 대표번호에{' '}
          <strong className="text-gray-900">도로명 상세주소 · 공동현관 출입번호 · 예상 물량(20kg 이상)</strong>을 문자로 보내주시면 자동 접수됩니다.
        </p>

        <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-blue-700 mb-0.5">문자 접수 전용 대표번호</p>
            <p className="text-xl font-black text-gray-900 tabular-nums">{representativePhone}</p>
          </div>
          <button
            type="button"
            onClick={() => void handleCopyPhone()}
            className="h-9 px-3 rounded-xl bg-white hover:bg-blue-100 border border-blue-200 text-xs font-bold text-blue-800 inline-flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">복사됨</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>번호 복사</span>
              </>
            )}
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-5">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-xs font-bold text-gray-600">문자 자동완성 양식 예시</p>
            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[11px] font-bold">
              자유 형식도 가능
            </span>
          </div>
          <div className="text-xs sm:text-sm font-medium text-gray-800 bg-gray-50 p-3.5 rounded-xl border border-gray-200 leading-relaxed space-y-1">
            <p className="font-extrabold text-blue-600">[올클 헌옷수거 문자접수]</p>
            <p>도로명 상세주소(동·호수): 수원시 영통구 광교중앙로 145, 102동 1503호</p>
            <p>공동현관 출입번호: #1234* (비대면 문앞 배출)</p>
            <p>예상물량(20kg 이상): 헌옷·가방 30kg (100L 봉투 3개)</p>
            <p>수거희망일(비대면): 내일</p>
          </div>
        </div>

        <div className="space-y-2.5">
          <a
            href={quickSmsHref}
            className="w-full min-h-[52px] py-3.5 px-5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-extrabold text-[15px] shadow-lg flex items-center justify-center gap-2 transition-all"
          >
            <MessageSquare className="w-5 h-5 shrink-0" />
            <span>휴대폰 문자 앱 열기</span>
          </a>
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[46px] py-3 px-5 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm flex items-center justify-center transition-colors cursor-pointer"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
