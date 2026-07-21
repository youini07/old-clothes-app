import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

interface CollectionItem {
  id: string;
  category: string;
  categoryLabel: string;
  quantity: number;
  unitType: string;
  unitPrice: number;
  subtotal: number;
  photoUrl?: string | null;
}

interface ReceiptData {
  id: string;
  userName: string;
  phone: string;
  partnerId: string | null;
  address: string;
  actualWeight: number | null;
  totalPrice: number | null;
  itemPhotoUrl: string | null;
  scalePhotoUrl: string | null;
  extraPhotoUrl: string | null;
  completedDate: string | null;
  collectionItems: CollectionItem[];
  status: string;
}

// ──────────────────────────────────────────
// 별점 버튼 컴포넌트 (1~5점, 탭 방식)
// ──────────────────────────────────────────
const StarRating = ({ label, emoji, value, onChange }: {
  label: string; emoji: string; value: number; onChange: (v: number) => void;
}) => (
  <div className="mb-4">
    <p className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-1.5">
      <span>{emoji}</span> {label}
    </p>
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className={`flex-1 py-2.5 rounded-xl text-lg font-bold transition-all duration-200 ${
            value >= star
              ? 'bg-amber-400 text-white shadow-md scale-105'
              : 'bg-gray-100 text-gray-300 hover:bg-gray-200'
          }`}
        >
          ⭐
        </button>
      ))}
    </div>
  </div>
);

export default function ReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 간편리뷰 상태
  const [ratingConvenience, setRatingConvenience] = useState(0); // 수거신청 편리성
  const [ratingKindness, setRatingKindness] = useState(0);       // 기사님 친절도
  const [ratingSpeed, setRatingSpeed] = useState(0);              // 수거/정산 신속정확
  const [reviewContent, setReviewContent] = useState('');         // 한줄평
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReceipt = async () => {
      try {
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/requests/${id}/receipt`);
        setReceipt(res.data);
      } catch (err: any) {
        console.error(err);
        setError(err.response?.data?.error || '영수증을 불러오는 데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchReceipt();
    }
  }, [id]);

  // 간편리뷰 등록 핸들러
  const handleSubmitReview = async () => {
    if (!ratingConvenience || !ratingKindness || !ratingSpeed) {
      setReviewError('모든 별점 항목을 선택해주세요.');
      return;
    }

    setIsSubmittingReview(true);
    setReviewError(null);

    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/board/reviews`, {
        requestId: id,
        ratingConvenience,
        ratingKindness,
        ratingSpeed,
        content: reviewContent,
      });
      setReviewSubmitted(true);
    } catch (err: any) {
      const msg = err.response?.data?.error || '리뷰 등록에 실패했습니다.';
      setReviewError(msg);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-500 font-medium">영수증 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-gray-50 p-6">
        <div className="text-6xl mb-4">📄</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">영수증을 찾을 수 없습니다</h2>
        <p className="text-gray-500 text-center">{error}</p>
      </div>
    );
  }

  // 개인정보 보호용 마스킹 처리 (이름 가운데 글자 등)
  const maskName = (name: string) => {
    if (!name || name.length < 2) return name;
    if (name.length === 2) return name[0] + '*';
    return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1];
  };

  // 주소에서 상세주소(동/호수) 제거하고 앞부분만 표시 (공백 3개 정도까지만)
  const maskAddress = (address: string) => {
    if (!address) return '';
    const parts = address.split(' ');
    return parts.slice(0, 3).join(' ') + ' ...';
  };

  const itemPhotos = receipt.collectionItems?.filter(i => i.photoUrl) || [];
  const hasPhotos = receipt.itemPhotoUrl || receipt.scalePhotoUrl || receipt.extraPhotoUrl || itemPhotos.length > 0;

  const aggregatedItems = receipt.collectionItems?.reduce((acc, item) => {
    if (!acc[item.categoryLabel]) {
      acc[item.categoryLabel] = {
        categoryLabel: item.categoryLabel,
        quantity: 0,
        unitType: item.unitType,
        subtotal: 0
      };
    }
    acc[item.categoryLabel].quantity += item.quantity;
    acc[item.categoryLabel].subtotal += item.subtotal;
    return acc;
  }, {} as Record<string, { categoryLabel: string; quantity: number; unitType: string; subtotal: number; }>) || {};
  const aggregatedItemsList = Object.values(aggregatedItems);

  return (
    <div className="min-h-[100dvh] bg-gray-100 flex flex-col items-center py-8 px-4 font-sans selection:bg-blue-100">
      
      {/* 영수증 컨테이너 */}
      <div className="w-full max-w-md bg-white rounded-3xl shadow-lg overflow-hidden animate-fade-in">
        
        {/* 상단 완료 뱃지 및 로고 영역 */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-center text-white relative">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-md">
            <span className="text-3xl">✅</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight mb-1">수거 완료</h1>
          <p className="text-blue-100 font-medium opacity-90 text-sm">
            {receipt.completedDate ? new Date(receipt.completedDate).toLocaleString('ko-KR', {
              year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
            }) : '완료 일시 정보 없음'}
          </p>
        </div>

        {/* 고객 정보 요약 */}
        <div className="p-6 border-b border-gray-100 bg-gray-50/50">
          <div className="flex justify-between items-center mb-3">
            <span className="text-gray-500 text-sm font-bold">고객명</span>
            <span className="text-gray-900 font-extrabold">{maskName(receipt.userName)} 님</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500 text-sm font-bold">수거지</span>
            <span className="text-gray-700 font-medium text-sm text-right">{maskAddress(receipt.address)}</span>
          </div>
        </div>

        {/* 메인 정산 금액 (크게 강조) */}
        <div className="p-8 text-center border-b border-gray-100">
          <p className="text-sm font-bold text-gray-500 mb-2">최종 정산 금액</p>
          <div className="text-5xl font-extrabold text-blue-600 tracking-tighter">
            {(receipt.totalPrice || 0).toLocaleString()}<span className="text-2xl ml-1 text-gray-900">원</span>
          </div>
        </div>

        {/* 항목별 상세 내역 */}
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span>📋</span> 정산 상세 내역
          </h3>
          
          {aggregatedItemsList && aggregatedItemsList.length > 0 ? (
            <div className="space-y-3">
              {aggregatedItemsList.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-700 font-medium">{item.categoryLabel}</span>
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-md font-bold">
                      {item.quantity}{item.unitType === 'KG' ? 'kg' : '대'}
                    </span>
                  </div>
                  <div className="font-bold text-gray-900">
                    {item.subtotal.toLocaleString()}원
                  </div>
                </div>
              ))}
              <div className="pt-3 mt-3 border-t border-dashed border-gray-200 flex justify-between items-center">
                <span className="text-gray-500 font-bold">총 합계</span>
                <span className="font-extrabold text-lg text-blue-600">{(receipt.totalPrice || 0).toLocaleString()}원</span>
              </div>
            </div>
          ) : (
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-700 font-medium">단일 무게 정산</span>
              <span className="text-gray-900 font-bold">{receipt.actualWeight}kg</span>
            </div>
          )}
        </div>

        {/* 홍보 영역 (영수증 바로 밑 캡처용 컴팩트 배너) */}
        <div className="bg-blue-50 px-4 py-3.5 border-t border-dashed border-gray-200 flex flex-col items-center justify-center gap-1.5">
          <p className="text-[13px] font-extrabold text-gray-800">✨ 쉽고 빠른 헌옷수거 <span className="text-blue-600">올클(ALL-CLEAR)</span></p>
          <div className="flex items-center gap-3 mt-0.5">
            <a href="https://www.all-cle.com" className="text-[13px] font-bold text-blue-600 flex items-center gap-1" target="_blank" rel="noopener noreferrer">
              🌐 www.all-cle.com
            </a>
            <span className="w-px h-3 bg-gray-300"></span>
            <a href="tel:010-5768-9952" className="text-[13px] font-bold text-gray-700 flex items-center gap-1">
              📞 010-5768-9952
            </a>
          </div>
        </div>

        {/* 수거 증빙 사진 갤러리 */}
        {hasPhotos && (
          <div className="p-6 bg-gray-50">
            <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span>📷</span> 수거 증빙 사진
            </h3>
            
            <div className="grid grid-cols-1 gap-4">
              {receipt.scalePhotoUrl && (
                <div className="relative group rounded-2xl overflow-hidden shadow-sm border border-gray-200 bg-white">
                  <div className="absolute top-3 left-3 bg-black/60 text-white px-3 py-1 rounded-full text-xs font-bold backdrop-blur-sm z-10">
                    ⚖️ 저울 무게 사진
                  </div>
                  <img src={receipt.scalePhotoUrl} alt="저울 사진" className="w-full h-auto object-cover" />
                </div>
              )}
              
              {itemPhotos.length > 0 ? (
                itemPhotos.map((item, idx) => (
                  <div key={`item-photo-${idx}`} className="relative group rounded-2xl overflow-hidden shadow-sm border border-gray-200 bg-white">
                    <div className="absolute top-3 left-3 bg-black/60 text-white px-3 py-1 rounded-full text-xs font-bold backdrop-blur-sm z-10">
                      📦 {item.categoryLabel || '수거 물품'} 사진
                    </div>
                    <img src={item.photoUrl!} alt="물품 사진" className="w-full h-auto object-cover" />
                  </div>
                ))
              ) : receipt.itemPhotoUrl ? (
                <div className="relative group rounded-2xl overflow-hidden shadow-sm border border-gray-200 bg-white">
                  <div className="absolute top-3 left-3 bg-black/60 text-white px-3 py-1 rounded-full text-xs font-bold backdrop-blur-sm z-10">
                    📦 수거 물품 사진
                  </div>
                  <img src={receipt.itemPhotoUrl} alt="물품 사진" className="w-full h-auto object-cover" />
                </div>
              ) : null}

              {receipt.extraPhotoUrl && (
                <div className="relative group rounded-2xl overflow-hidden shadow-sm border border-gray-200 bg-white">
                  <div className="absolute top-3 left-3 bg-black/60 text-white px-3 py-1 rounded-full text-xs font-bold backdrop-blur-sm z-10">
                    📝 특이사항 사진
                  </div>
                  <img src={receipt.extraPhotoUrl} alt="특이사항 사진" className="w-full h-auto object-cover" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────
            간편리뷰 등록 섹션
            - 영수증 하단에서 바로 리뷰를 등록할 수 있는 폼
            - 별점 3항목 + 한줄평으로 구성
            - 등록하면 개인정보가 마스킹된 상태로 후기 게시판에 자동 등록됨
        ──────────────────────────────────────────── */}
        {receipt.status === 'COMPLETED' && receipt.partnerId && (
          <div className="border-t-4 border-amber-400">
            {reviewSubmitted ? (
              // 리뷰 등록 완료 화면
              <div className="p-8 text-center bg-gradient-to-b from-amber-50 to-white">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                  <span className="text-4xl">🎉</span>
                </div>
                <h3 className="text-xl font-extrabold text-gray-900 mb-2">리뷰가 등록되었습니다!</h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  소중한 후기 감사합니다.<br/>
                  개인정보가 보호된 상태로 후기 게시판에 자동 등록되었습니다.
                </p>
                <div className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-amber-100 rounded-full">
                  <span className="text-amber-600 font-bold text-sm">⭐ {((ratingConvenience + ratingKindness + ratingSpeed) / 3).toFixed(1)}점</span>
                </div>
              </div>
            ) : (
              // 리뷰 입력 폼
              <div className="p-6 bg-gradient-to-b from-amber-50 to-white">
                {/* 헤더 */}
                <div className="text-center mb-6">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-400 text-white rounded-full text-xs font-extrabold mb-3">
                    ⭐ 간편리뷰
                  </div>
                  <h3 className="text-lg font-extrabold text-gray-900">이런 점이 좋았어요!</h3>
                  <p className="text-xs text-gray-400 mt-1">별점을 눌러 평가해 주세요 (각 항목 1~5점)</p>
                </div>

                {/* 별점 평가 3항목 */}
                <StarRating
                  label="수거 신청이 편리했나요?"
                  emoji="📱"
                  value={ratingConvenience}
                  onChange={setRatingConvenience}
                />
                <StarRating
                  label="기사님이 친절했나요?"
                  emoji="🤝"
                  value={ratingKindness}
                  onChange={setRatingKindness}
                />
                <StarRating
                  label="수거 및 정산이 신속·정확했나요?"
                  emoji="⚡"
                  value={ratingSpeed}
                  onChange={setRatingSpeed}
                />

                {/* 한줄평 */}
                <div className="mt-5">
                  <label className="text-sm font-bold text-gray-700 mb-2 block">✏️ 한줄평 (선택)</label>
                  <textarea
                    value={reviewContent}
                    onChange={(e) => setReviewContent(e.target.value)}
                    placeholder="서비스 이용 후기를 한 줄로 남겨주세요..."
                    maxLength={200}
                    rows={2}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:border-amber-400 focus:outline-none resize-none transition-colors placeholder:text-gray-300"
                  />
                  <p className="text-right text-[11px] text-gray-300 mt-1">{reviewContent.length}/200자</p>
                </div>

                {/* 안내 문구 */}
                <div className="mt-4 p-3 bg-blue-50 rounded-xl border border-blue-100">
                  <p className="text-[11px] text-blue-600 font-medium leading-relaxed break-keep">
                    💡 등록 시 <b>간편리뷰</b>로 후기 게시판에 자동 등록됩니다.<br/>
                    개인정보는 보호됩니다: 이름(앞 2글자만), 주소(동까지만), 전화번호(중간자리 숨김) 처리 후 영수증 요약과 함께 게시됩니다.
                  </p>
                </div>

                {/* 에러 메시지 */}
                {reviewError && (
                  <div className="mt-3 p-3 bg-red-50 rounded-xl border border-red-100">
                    <p className="text-xs text-red-600 font-medium">{reviewError}</p>
                  </div>
                )}

                {/* 등록 버튼 */}
                <button
                  onClick={handleSubmitReview}
                  disabled={isSubmittingReview || (!ratingConvenience || !ratingKindness || !ratingSpeed)}
                  className={`w-full mt-5 py-4 rounded-2xl font-extrabold text-base transition-all duration-200 ${
                    ratingConvenience && ratingKindness && ratingSpeed
                      ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-white shadow-lg hover:shadow-xl active:scale-[0.98]'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {isSubmittingReview ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      등록 중...
                    </span>
                  ) : (
                    '⭐ 간편리뷰 등록하기'
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* 푸터 영역 */}
        <div className="p-6 bg-gray-900 text-center text-gray-400 text-[11px] break-keep leading-relaxed">
          <p className="font-medium mb-1">올클(ALL-CLEAR) 헌옷 수거 서비스를 이용해 주셔서 감사합니다.</p>
          <p>이 영수증 페이지는 알림톡(문자) 수신자 본인만 확인할 수 있습니다.</p>
        </div>
      </div>
      
    </div>
  );
}
