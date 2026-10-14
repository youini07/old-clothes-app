import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ExternalLink, MapPin, Search, Sparkles } from 'lucide-react';
import {
  DEFAULT_SEO_REVIEWS,
  normalizePublicReviews,
  type SeoReviewItem,
} from '../components/SeoReviewSection';

const KAKAO_LOGIN_URL = `${import.meta.env.VITE_API_URL}/auth/kakao`;

const REGION_CATEGORIES = [
  { key: 'ALL', label: '전체 지역', keywords: [] as string[] },
  { key: 'HWASEONG', label: '화성·동탄·병점·봉담', keywords: ['화성', '동탄', '병점', '봉담', '향남', '남양'] },
  { key: 'YONGIN', label: '용인·수지·기흥·처인', keywords: ['용인', '수지', '기흥', '죽전', '처인', '보정'] },
  { key: 'SUWON', label: '수원·영통·광교·권선', keywords: ['수원', '영통', '광교', '권선', '장안', '팔달', '인계'] },
  { key: 'SEONGNAM', label: '성남·분당·판교·위례', keywords: ['성남', '분당', '판교', '위례', '수정', '중원'] },
  { key: 'OSAN_ETC', label: '오산·평택·안양·기타', keywords: ['오산', '세교', '평택', '안양', '광주', '서울', '강남', '마포'] },
];

/**
 * [공개 고객 후기 & 지역별 수거 정산 내역 전용 아카이브 페이지 (/reviews)]
 * 왜 별도 페이지로 분리했는가:
 * 1) 구글 서치콘솔에서 메인(/) 단 1개만 색인되던 문제를 해결하여 유효 색인 페이지를 확장하고,
 * 2) 고객이 작성한 모든 리뷰(최대 100건 이상)와 지역별·품목별 정산 내역을 검색엔진 로봇이
 *    누락 없이 크롤링할 수 있도록 시맨틱 구조(<main>, <article>, <h1>~<h3>)로 제공하기 위함입니다.
 */
export default function PublicReviewsPage() {
  const [reviews, setReviews] = useState<SeoReviewItem[]>(DEFAULT_SEO_REVIEWS);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedRegion, setSelectedRegion] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 페이지 진입 시 스크롤 최상단 이동 및 브라우저 문서 타이틀(SEO) 업데이트
  useEffect(() => {
    window.scrollTo(0, 0);
    const prevTitle = document.title;
    document.title = '실시간 헌옷 방문수거 후기 & 지역별 정산 금액 | 올클(ALL-CLEAR)';

    return () => {
      document.title = prevTitle;
    };
  }, []);

  // 백엔드 공개 리뷰 API에서 최대 100건의 실제 고객 후기 로드 (로컬 DB가 비어 있으면 실서버 읽기 전용 API로 폴백)
  useEffect(() => {
    let isMounted = true;
    const PROD_PUBLIC_API = 'https://old-clothes-app-production.up.railway.app/api';
    setLoading(true);

    fetch(`${import.meta.env.VITE_API_URL}/board/public/reviews?limit=100`)
      .then((res) => {
        if (!res.ok) throw new Error('리뷰 응답 오류');
        return res.json();
      })
      .then(async (data) => {
        if (isMounted && Array.isArray(data?.posts) && data.posts.length > 0) {
          setReviews(normalizePublicReviews(data.posts));
        } else if (isMounted && import.meta.env.VITE_API_URL !== PROD_PUBLIC_API) {
          const prodRes = await fetch(`${PROD_PUBLIC_API}/board/public/reviews?limit=100`);
          const prodData = await prodRes.json();
          if (isMounted && Array.isArray(prodData?.posts) && prodData.posts.length > 0) {
            setReviews(normalizePublicReviews(prodData.posts));
          }
        }
      })
      .catch(async () => {
        try {
          const prodRes = await fetch(`${PROD_PUBLIC_API}/board/public/reviews?limit=100`);
          const prodData = await prodRes.json();
          if (isMounted && Array.isArray(prodData?.posts) && prodData.posts.length > 0) {
            setReviews(normalizePublicReviews(prodData.posts));
          }
        } catch (err) {
          console.error('전체 후기 로드 실패 (안전 폴백 유지):', err);
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // 지역 탭 + 검색어(동네명, 수거품목 등) 복합 필터링
  const filteredReviews = useMemo(() => {
    return reviews.filter((review) => {
      // 1. 지역 필터
      if (selectedRegion !== 'ALL') {
        const regionObj = REGION_CATEGORIES.find((r) => r.key === selectedRegion);
        if (regionObj && regionObj.keywords.length > 0) {
          const matchesRegion = regionObj.keywords.some(
            (kw) => review.region.includes(kw) || review.meta.includes(kw)
          );
          if (!matchesRegion) return false;
        }
      }

      // 2. 검색어 필터
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const targetText = `${review.region} ${review.text} ${review.receiptDetails} ${review.receiptTotal}`.toLowerCase();
        if (!targetText.includes(q)) return false;
      }

      return true;
    });
  }, [reviews, selectedRegion, searchQuery]);

  // 평균 평점 계산
  const averageRating = useMemo(() => {
    if (reviews.length === 0) return '5.0';
    const total = reviews.reduce((sum, r) => sum + (r.stars || 5), 0);
    return (total / reviews.length).toFixed(1);
  }, [reviews]);

  return (
    <div className="min-h-screen bg-[#F7F8FC] text-gray-900 font-sans">
      {/* 상단 고정 네비게이션 헤더 */}
      <header className="sticky top-0 inset-x-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-600 hover:text-primary-600 transition-colors py-2 px-3 rounded-xl hover:bg-gray-50"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>홈으로</span>
            </Link>
            <span className="text-gray-200">|</span>
            <Link to="/" className="flex items-baseline gap-1.5">
              <span className="text-xl font-black tracking-tight text-primary-600">올클</span>
              <span className="text-xs font-extrabold text-gray-400 hidden sm:inline">ALL-CLEAR</span>
            </Link>
          </div>

          <a
            href={KAKAO_LOGIN_URL}
            className="px-4 py-2 rounded-full bg-[#FEE500] text-yellow-950 text-xs sm:text-sm font-extrabold hover:brightness-95 transition-all shadow-xs"
          >
            💬 3초 수거 신청하기
          </a>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        {/* 상단 히어로 & SEO H1 헤더 */}
        <section className="bg-gradient-to-br from-primary-600 to-indigo-700 rounded-3xl p-6 sm:p-10 text-white shadow-xl mb-10 relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-xs text-xs font-extrabold mb-4">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>100% 실제 수거 영수증 연동 고객 후기</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight break-keep">
                올클 헌옷 방문수거 후기 &amp; 지역별 실제 정산 내역
              </h1>
              <p className="mt-3 text-blue-100 text-xs sm:text-base font-medium max-w-2xl leading-relaxed break-keep">
                화성(동탄·병점·봉담), 용인(수지·기흥·처인), 수원(영통·광교), 성남(분당·판교), 오산까지!
                기사님이 직접 계근한 무게와 당일 현금으로 입금된 실제 정산 금액을 확인해 보세요.
              </p>
            </div>

            {/* 평점 요약 박스 */}
            <div className="bg-white/15 backdrop-blur-md border border-white/20 rounded-2xl p-5 text-center shrink-0 min-w-[200px]">
              <p className="text-xs font-bold text-blue-100 mb-1">고객 평균 만족도</p>
              <div className="text-3xl sm:text-4xl font-black text-amber-300 tracking-tight">
                ★ {averageRating} <span className="text-base font-bold text-white/80">/ 5.0</span>
              </div>
              <p className="text-[11px] text-blue-100 font-medium mt-2 flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-300" />
                <span>수거 완료 영수증 인증 리뷰</span>
              </p>
            </div>
          </div>
        </section>

        {/* 지역별 필터 & 키워드 검색 바 */}
        <section aria-label="리뷰 지역 및 키워드 검색" className="mb-8 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {REGION_CATEGORIES.map((cat) => {
              const active = selectedRegion === cat.key;
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setSelectedRegion(cat.key)}
                  className={`px-4 py-2 rounded-full text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
                    active
                      ? 'bg-primary-600 text-white shadow-md shadow-primary-500/20'
                      : 'bg-white text-gray-600 border border-gray-200 hover:border-primary-200 hover:text-primary-600'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="우리 동네 이름(예: 동탄, 수지, 광교)이나 품목(헌옷, 헌책, 냄비) 검색"
              className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white border border-gray-200 text-sm font-medium text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-primary-500 shadow-2xs"
            />
          </div>
        </section>

        {/* 리뷰 카드 그리드 목록 */}
        {loading ? (
          <div className="py-20 text-center">
            <div className="w-9 h-9 border-4 border-blue-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-sm text-gray-500 font-bold">실시간 수거 후기를 불러오는 중입니다...</p>
          </div>
        ) : filteredReviews.length === 0 ? (
          <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center shadow-xs">
            <p className="text-gray-700 font-extrabold text-base mb-2">
              검색하신 조건에 맞는 후기가 아직 없습니다.
            </p>
            <p className="text-xs text-gray-400 mb-5">
              다른 지역 탭을 선택하시거나 검색어를 지워보세요.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedRegion('ALL');
                setSearchQuery('');
              }}
              className="px-5 py-2.5 rounded-xl bg-primary-600 text-white text-xs font-extrabold hover:bg-primary-700 transition-colors"
            >
              전체 지역 후기 보기
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {filteredReviews.map((review) => {
              const firstItem = review.receiptDetails.split('|')[0]?.trim() || '헌옷 방문수거';
              return (
                <article
                  key={review.id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 flex flex-col justify-between hover:shadow-md transition-shadow"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div
                        className="flex gap-0.5 text-yellow-400 text-base"
                        aria-label={`별점 5점 만점에 ${review.stars}점`}
                      >
                        {'★'.repeat(review.stars)}
                      </div>
                      <time dateTime={review.dateISO} className="text-xs text-gray-400 font-medium">
                        {review.dateDisplay}
                      </time>
                    </div>

                    <h2 className="text-xs sm:text-sm font-extrabold text-primary-700 bg-primary-50/80 border border-primary-100 px-3 py-1.5 rounded-lg mb-3 flex items-center gap-1.5 break-keep">
                      <MapPin className="w-3.5 h-3.5 shrink-0 text-primary-600" />
                      <span>
                        {review.region} · {firstItem}
                      </span>
                    </h2>

                    <blockquote className="text-gray-800 font-extrabold text-base mb-3 leading-snug break-keep">
                      "{review.text}"
                    </blockquote>

                    <p className="text-xs text-gray-400 font-medium mb-4">{review.meta}</p>
                  </div>

                  <div>
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 mb-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-bold text-gray-500">🧾 수거 정산서</span>
                        <span className="text-[11px] font-bold text-green-600">당일 정산</span>
                      </div>
                      <div className="font-black text-primary-600 text-xl mb-1">{review.receiptTotal}</div>
                      <p className="text-xs text-gray-500 font-medium break-keep">{review.receiptDetails}</p>
                    </div>

                    {review.externalLinks && review.externalLinks.length > 0 && (
                      <div className="mb-4 pt-3 border-t border-dashed border-gray-200">
                        <p className="text-[11px] font-extrabold text-emerald-700 mb-2 flex items-center gap-1">
                          <span>✨</span> 고객 직접 작성 인증 후기 원문
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {review.externalLinks.map((link, lIdx) => (
                            <a
                              key={lIdx}
                              href={link.url}
                              target="_blank"
                              rel="ugc nofollow noopener noreferrer"
                              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all border ${
                                link.kind === 'cafe'
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                                  : link.kind === 'blog'
                                  ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                                  : 'bg-pink-50 border-pink-200 text-pink-700 hover:bg-pink-100'
                              }`}
                            >
                              <span>{link.label}</span>
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-1.5">
                      {review.tags.map((tag, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 rounded-full bg-orange-50/70 border border-orange-100 text-orange-600 text-[10px] font-bold"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* 하단 SEO 지역 키워드 요약 & 수거 신청 CTA */}
        <section className="mt-14 bg-white rounded-3xl border border-primary-100 p-8 sm:p-10 text-center shadow-sm">
          <h2 className="text-xl sm:text-3xl font-black text-gray-900 mb-3 break-keep">
            옷장 속 안 입는 옷, 문 앞에 두고 현금으로 정산받으세요!
          </h2>
          <p className="text-xs sm:text-base text-gray-600 font-medium max-w-xl mx-auto mb-6 leading-relaxed break-keep">
            헌옷·신발·가방·헌책·후라이팬·냄비 등 20kg 이상이면 비대면 방문수거 가능!
            계근 사진 증빙으로 투명하게 정산해 드립니다.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href={KAKAO_LOGIN_URL}
              className="w-full sm:w-auto px-8 py-4 rounded-full bg-[#FEE500] text-yellow-950 font-extrabold text-sm sm:text-base shadow-md hover:brightness-95 transition-all"
            >
              💬 카카오로 3초 만에 방문수거 신청하기
            </a>
            <Link
              to="/"
              className="w-full sm:w-auto px-8 py-4 rounded-full bg-gray-100 text-gray-700 font-bold text-sm sm:text-base hover:bg-gray-200 transition-all"
            >
              서비스 안내 자세히 보기
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
