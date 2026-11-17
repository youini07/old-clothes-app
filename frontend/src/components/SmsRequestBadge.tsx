import React from 'react';

/**
 * 접수 채널(문자 자동접수 / 전화 수동접수) 뱃지 및 수신 문자 원문 표시 컴포넌트
 *
 * [왜 별도 컴포넌트로 모듈화했는가]
 * AdminDashboard의 신규 수거 요청 카드, 대기중인 수거 카드, 기사 배차 카드, 정보 수정 모달에서
 * 동일한 디자인과 주소 확인 경고('[주소확인필요]') 로직을 재사용하여 코드 중복을 없애고 가독성을 높이기 위함입니다.
 */

export const RequestSourceBadge: React.FC<{
  requestSource?: string | null;
  address?: string | null;
}> = ({ requestSource, address }) => {
  const needsAddressConfirm = Boolean(address && address.startsWith('[주소확인필요]'));

  return (
    <>
      {requestSource === 'SMS' && (
        <span className="inline-flex items-center gap-0.5 bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0">
          📩 문자자동
        </span>
      )}
      {requestSource === 'MANUAL' && (
        <span className="inline-flex items-center gap-0.5 bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0">
          📞 전화접수
        </span>
      )}
      {needsAddressConfirm && (
        <span className="inline-flex items-center gap-0.5 bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0">
          ⚠️ 주소확인필요
        </span>
      )}
    </>
  );
};

export const RawSmsPreviewBox: React.FC<{
  rawSmsText?: string | null;
  address?: string | null;
  compact?: boolean;
}> = ({ rawSmsText, address, compact = false }) => {
  const cleanRaw = (rawSmsText || '').trim();
  if (!cleanRaw) return null;

  const isUnconfirmed = Boolean(address && address.startsWith('[주소확인필요]'));

  return (
    <div
      className={`mt-2 rounded-xl border px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap break-all ${
        isUnconfirmed
          ? 'bg-amber-50/90 border-amber-200 text-amber-950'
          : 'bg-indigo-50/60 border-indigo-100 text-gray-800'
      }`}
    >
      <div className="font-bold text-[11px] mb-0.5 flex items-center justify-between gap-2">
        <span className={isUnconfirmed ? 'text-amber-800' : 'text-indigo-700'}>
          💬 고객 수신 문자 원문
        </span>
        {isUnconfirmed && !compact && (
          <span className="text-[10px] font-semibold text-amber-700">
            ✏️ [정보 수정]에서 도로명 주소를 검색해 확정해주세요
          </span>
        )}
      </div>
      <div>{cleanRaw}</div>
    </div>
  );
};
