import { useEffect, useRef, useState } from 'react';
import { formatPhoneNumber } from '../utils/phone';

interface ReviewCustomerContactProps {
  customerPhone?: string | null;
  customerName?: string | null;
  authorName?: string;
  maskedPhone?: string | null;
  showMaskedFallback?: boolean;
}

/**
 * 왜 별도 컴포넌트로 분리했는가:
 * 사장님 대시보드(AdminDashboard)와 게시판(BoardPage) 후기 카드에서
 * 관리자용 고객 실명/전화번호 표시 및 원터치 복사 UI를 중복 없이 재사용하기 위함입니다.
 */
export default function ReviewCustomerContact({
  customerPhone,
  customerName,
  authorName,
  maskedPhone,
  showMaskedFallback = false,
}: ReviewCustomerContactProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  if (!customerPhone) {
    if (!showMaskedFallback || !maskedPhone) return null;
    return (
      <div className="mt-2 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-[11px] text-gray-500 flex items-center gap-1.5">
        <span>📞 {maskedPhone}</span>
        <span className="text-gray-400">(원본 수거내역 없음)</span>
      </div>
    );
  }

  const formattedPhone = formatPhoneNumber(customerPhone);
  const cleanedPhone = customerPhone.replace(/\D/g, '') || customerPhone;
  const showRealName = Boolean(customerName && customerName !== authorName);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(formattedPhone);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = formattedPhone;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      alert(`전화번호: ${formattedPhone}`);
    }
  };

  return (
    <div className="mt-2 px-2.5 py-1.5 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-between gap-2 flex-wrap">
      <div className="flex items-center gap-2 flex-wrap text-xs">
        {showRealName && (
          <span className="font-bold text-gray-800">👤 {customerName}</span>
        )}
        <a
          href={`tel:${cleanedPhone}`}
          className="font-bold text-blue-700 hover:underline tabular-nums"
        >
          📞 {formattedPhone}
        </a>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className="px-2 py-0.5 bg-white hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-[11px] font-bold transition-colors"
      >
        {copied ? '✓ 복사됨' : '복사'}
      </button>
    </div>
  );
}
