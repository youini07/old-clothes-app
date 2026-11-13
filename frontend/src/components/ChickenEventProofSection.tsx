import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, ZoomIn, X, CheckCircle2, Gift } from 'lucide-react';

interface ChickenEventProofSectionProps {
  title?: string | null;
  images: string[];
  mode: 'card' | 'showcase';
}

const DEFAULT_PROOF_TITLE = '지난달 당첨자 치킨 기프티콘 발송 완료!';

/**
 * 홈페이지 '진행중인 이벤트' 섹션 내 지난달 당첨자 기프티콘 전송 인증 스샷 쇼케이스
 * 왜 2가지 모드('card' | 'showcase')를 지원하는가:
 * - 당첨자 발표 유튜브 영상이 없을 때('card')는 왼쪽 이벤트 포스터 카드와 나란히 2열 균형을 맞추고,
 * - 유튜브 영상이 있을 때('showcase')는 상단 2열(포스터+영상) 바로 아래 풀와이드 갤러리로 배치하여
 *   모바일/PC 모두에서 답답함 없이 깔끔하게 노출하기 위함입니다.
 */
export default function ChickenEventProofSection({
  title,
  images,
  mode
}: ChickenEventProofSectionProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const displayTitle = title?.trim() || DEFAULT_PROOF_TITLE;
  const safeActiveIndex = images.length > 0 ? Math.min(activeIndex, images.length - 1) : 0;

  // 라이트박스 열려 있을 때 배경 스크롤 잠금 및 키보드 좌우/ESC 이동 지원
  useEffect(() => {
    if (lightboxIndex === null) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxIndex(null);
      } else if (e.key === 'ArrowLeft' && images.length > 1) {
        setLightboxIndex((prev) => (prev === null ? null : (prev - 1 + images.length) % images.length));
      } else if (e.key === 'ArrowRight' && images.length > 1) {
        setLightboxIndex((prev) => (prev === null ? null : (prev + 1) % images.length));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [lightboxIndex, images.length]);

  if (!images || images.length === 0) return null;

  const handlePrevSlide = () => {
    setActiveIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleNextSlide = () => {
    setActiveIndex((prev) => (prev + 1) % images.length);
  };

  // 쇼케이스 모드에서 이미지 개수에 맞춘 데스크탑 그리드 컬럼 계산
  const getShowcaseGridClass = () => {
    if (images.length === 1) return 'max-w-[270px] mx-auto grid grid-cols-1';
    if (images.length === 2) return 'max-w-xl mx-auto grid grid-cols-2 gap-4 sm:gap-6';
    if (images.length === 3) return 'max-w-3xl mx-auto grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-5';
    if (images.length === 4) return 'grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5';
    return 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4';
  };

  return (
    <>
      {mode === 'card' ? (
        /* ── 모드 A: 유튜브 영상이 없을 때 오른쪽 2열 전용 인터랙티브 인증샷 카드 ── */
        <div className="bg-white rounded-3xl shadow-xl p-6 sm:p-8 border border-amber-100 h-full flex flex-col relative overflow-hidden text-center">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-400 via-orange-500 to-red-500" />

          <div className="mb-5">
            <span className="inline-flex items-center gap-1.5 py-1.5 px-4 rounded-full bg-emerald-50 text-emerald-700 text-xs sm:text-sm font-extrabold mb-3 border border-emerald-200 shadow-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              100% 실제 발송 인증 · {images.length}건
            </span>
            <h3 className="text-2xl sm:text-3xl font-black text-gray-900 leading-snug break-keep">
              {displayTitle}
            </h3>
            <p className="text-gray-500 mt-2 text-sm font-medium break-keep">
              매월 리뷰 추첨 당첨자분들께 실제로 치킨 기프티콘을 보내드리고 있습니다.
            </p>
          </div>

          {/* 메인 인증샷 뷰어 */}
          <div className="relative flex-1 flex flex-col justify-center bg-gradient-to-b from-amber-50/70 via-orange-50/30 to-sky-50/60 rounded-2xl p-4 border border-amber-100/80">
            <div
              onClick={() => setLightboxIndex(safeActiveIndex)}
              className="relative mx-auto w-full h-[340px] sm:h-[380px] flex items-center justify-center cursor-zoom-in group"
            >
              <img
                src={images[safeActiveIndex]}
                alt={`지난달 당첨자 치킨 기프티콘 인증샷 ${safeActiveIndex + 1}`}
                className="max-h-full max-w-full w-auto object-contain rounded-2xl shadow-lg border border-white group-hover:scale-[1.02] transition-transform duration-200"
              />

              {/* 좌상단 발송완료 배지 */}
              <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-600/90 text-white text-[11px] font-extrabold shadow-sm backdrop-blur-sm">
                <CheckCircle2 className="w-3.5 h-3.5" /> 발송완료
              </span>

              {/* 우상단 크게보기 버튼 */}
              <span className="absolute top-2 right-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-900/70 text-white text-[11px] font-bold shadow-sm backdrop-blur-sm group-hover:bg-gray-900 transition-colors">
                <ZoomIn className="w-3.5 h-3.5" /> 크게 보기
              </span>
            </div>

            {/* 여러 장일 때 좌우 넘김 버튼 */}
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={handlePrevSlide}
                  aria-label="이전 인증샷"
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-gray-800 shadow-md border border-gray-100 flex items-center justify-center transition-all active:scale-95"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={handleNextSlide}
                  aria-label="다음 인증샷"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-gray-800 shadow-md border border-gray-100 flex items-center justify-center transition-all active:scale-95"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}

            {/* 여러 장일 때 썸네일 네비게이션 스트립 */}
            {images.length > 1 && (
              <div className="mt-4 flex items-center justify-center gap-2 overflow-x-auto py-1 px-1">
                {images.map((src, idx) => (
                  <button
                    key={`card-thumb-${idx}`}
                    type="button"
                    onClick={() => setActiveIndex(idx)}
                    className={`relative w-12 h-14 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${
                      idx === safeActiveIndex
                        ? 'border-amber-500 ring-2 ring-amber-300/60 scale-105 shadow-sm'
                        : 'border-white opacity-65 hover:opacity-100'
                    }`}
                  >
                    <img src={src} alt={`인증샷 썸네일 ${idx + 1}`} className="w-full h-full object-cover object-top" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <p className="mt-4 text-xs text-gray-400 font-semibold">
            👆 이미지를 누르시면 전송 내역을 원본 크기로 선명하게 확인할 수 있습니다.
          </p>
        </div>
      ) : (
        /* ── 모드 B: 유튜브 영상과 함께 노출되는 풀와이드 프리미엄 쇼케이스 카드 ── */
        <div className="mt-8 bg-white rounded-3xl shadow-xl p-6 sm:p-10 border border-amber-100 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-400 via-orange-500 to-red-500" />

          {/* 헤더 */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-7 text-center md:text-left">
            <div>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-3">
                <span className="inline-flex items-center gap-1.5 py-1.5 px-3.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-extrabold border border-emerald-200 shadow-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  100% 실제 발송 인증
                </span>
                <span className="inline-flex items-center gap-1 py-1.5 px-3 rounded-full bg-amber-50 text-amber-800 text-xs font-extrabold border border-amber-200">
                  <Gift className="w-3.5 h-3.5 text-amber-600" />
                  총 {images.length}건 전송 완료
                </span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight break-keep">
                {displayTitle}
              </h3>
              <p className="text-gray-500 mt-1.5 text-sm sm:text-base font-medium break-keep">
                추첨에만 그치지 않고, 매월 당첨자분들께 직접 치킨 기프티콘을 전송해드리고 있습니다.
              </p>
            </div>
            <div className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gray-50 border border-gray-200 text-xs font-bold text-gray-600 shrink-0">
              <ZoomIn className="w-4 h-4 text-amber-500" />
              클릭하면 크게 볼 수 있어요
            </div>
          </div>

          {/* 인증샷 갤러리 (4장 이상일 때 모바일에서는 스와이프 캐러셀, 태블릿/PC에서는 그리드) */}
          <div
            className={
              images.length >= 4
                ? 'flex overflow-x-auto snap-x snap-mandatory gap-3.5 pb-2 sm:pb-0 sm:overflow-visible sm:grid sm:grid-cols-3 lg:grid-cols-5 sm:gap-4'
                : getShowcaseGridClass()
            }
          >
            {images.map((src, idx) => (
              <button
                key={`proof-card-${idx}`}
                type="button"
                onClick={() => setLightboxIndex(idx)}
                className={`group relative rounded-2xl overflow-hidden border border-amber-100 bg-gradient-to-b from-amber-50/40 to-white shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-200 text-left focus:outline-none focus:ring-2 focus:ring-amber-400 ${
                  images.length >= 4 ? 'w-[62%] shrink-0 snap-start sm:w-auto sm:shrink' : 'w-full'
                }`}
              >
                <div className="aspect-[3/4] w-full overflow-hidden relative bg-gray-100">
                  <img
                    src={src}
                    alt={`지난달 당첨자 기프티콘 전송 인증샷 ${idx + 1}`}
                    loading="lazy"
                    className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
                  />

                  {/* 상단 배지 */}
                  <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-600/90 text-white text-[10px] font-extrabold shadow-sm backdrop-blur-sm">
                    <CheckCircle2 className="w-3 h-3" /> 발송완료
                  </span>
                  <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-bold backdrop-blur-sm">
                    #{idx + 1}
                  </span>

                  {/* 호버 확대 오버레이 */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity px-3 py-1.5 rounded-full bg-white/95 text-gray-900 text-xs font-extrabold shadow-lg flex items-center gap-1">
                      <ZoomIn className="w-3.5 h-3.5 text-amber-600" /> 크게 보기
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <p className="mt-4 text-center text-xs text-gray-400 font-semibold sm:hidden">
            {images.length >= 4
              ? '👆 옆으로 넘기거나 이미지를 눌러 크게 확인하세요!'
              : '👆 이미지를 누르시면 원본 크기로 크게 볼 수 있습니다.'}
          </p>
        </div>
      )}

      {/* 고해상도 라이트박스 확대 모달 (transform 부모 영향을 피하기 위해 Portal 사용) */}
      {lightboxIndex !== null && images[lightboxIndex] && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
          onClick={() => setLightboxIndex(null)}
        >
          <div
            className="relative max-w-3xl w-full flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 상단 바 */}
            <div className="w-full flex items-center justify-between text-white mb-3 px-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/90 text-white text-xs font-extrabold shrink-0">
                  발송완료 인증
                </span>
                <span className="text-sm font-bold truncate">
                  {displayTitle} ({lightboxIndex + 1} / {images.length})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setLightboxIndex(null)}
                aria-label="닫기"
                className="p-2 rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 메인 이미지 + 좌우 네비게이션 */}
            <div className="relative w-full flex items-center justify-center">
              {images.length > 1 && (
                <button
                  type="button"
                  onClick={() => setLightboxIndex((lightboxIndex - 1 + images.length) % images.length)}
                  aria-label="이전 이미지"
                  className="absolute left-1 sm:left-3 z-10 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/60 hover:bg-black/80 text-white border border-white/20 flex items-center justify-center transition-all active:scale-95"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              )}

              <img
                src={images[lightboxIndex]}
                alt={`기프티콘 발송 인증샷 확대 ${lightboxIndex + 1}`}
                className="max-h-[75vh] w-auto max-w-full object-contain rounded-2xl shadow-2xl bg-white"
              />

              {images.length > 1 && (
                <button
                  type="button"
                  onClick={() => setLightboxIndex((lightboxIndex + 1) % images.length)}
                  aria-label="다음 이미지"
                  className="absolute right-1 sm:right-3 z-10 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/60 hover:bg-black/80 text-white border border-white/20 flex items-center justify-center transition-all active:scale-95"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              )}
            </div>

            {/* 하단 썸네일 바 */}
            {images.length > 1 && (
              <div className="mt-4 flex items-center justify-center gap-2 overflow-x-auto max-w-full py-1 px-2">
                {images.map((src, idx) => (
                  <button
                    key={`lb-thumb-${idx}`}
                    type="button"
                    onClick={() => setLightboxIndex(idx)}
                    className={`w-12 h-14 rounded-lg overflow-hidden shrink-0 border-2 transition-all ${
                      idx === lightboxIndex
                        ? 'border-amber-400 scale-105 shadow-lg opacity-100'
                        : 'border-white/30 opacity-50 hover:opacity-90'
                    }`}
                  >
                    <img src={src} alt={`인증샷 ${idx + 1}`} className="w-full h-full object-cover object-top" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
