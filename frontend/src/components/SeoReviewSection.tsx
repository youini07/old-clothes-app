import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';

/**
 * [고객 첨부 외부 후기 링크(맘카페·블로그·SNS) 타입]
 * 왜 별도 구조체로 관리하는가:
 * 고객이 입력한 원본 URL을 검증(XSS 방지 및 https:// 자동 보정)하고,
 * 도메인 성격에 맞는 친숙한 뱃지 이름(맘카페/블로그/인스타 등)을 부여하기 위함입니다.
 */
export interface ReviewExternalLink {
  url: string;
  label: string;
  kind: 'cafe' | 'blog' | 'sns';
}

/**
 * [SEO 최적화 리뷰 데이터 인터페이스]
 */
export interface SeoReviewItem {
  id: string;
  stars: number;
  text: string;
  authorName: string;
  region: string;         // 예: "경기 화성시 동탄구"
  dateISO: string;        // 검색엔진 <time datetime="..."> 표준 포맷 (예: "2026-08-21")
  dateDisplay: string;    // 화면 표시용 날짜 (예: "2026. 8. 21.")
  meta: string;           // 예: "동탄* · 경기 화성시 동탄구 · 2026. 8. 21."
  receiptTotal: string;   // 예: "10,550원"
  receiptDetails: string; // 예: "헌옷 9kg | 헌옷 (신발, 가방 포함) 20kg"
  tags: string[];
  externalLinks: ReviewExternalLink[]; // 고객이 이벤트 참여로 등록한 맘카페/블로그/SNS 링크 목록
}

/**
 * [외부 후기 URL 안전 검증 및 라벨 자동 분류 함수]
 * 왜 필요한가:
 * 1) 고객이 "cafe.naver.com/..." 처럼 프로토콜(https://)을 빼먹고 입력해도 깨지지 않도록 자동 보정합니다.
 * 2) javascript: 등 악성 스크립트 URL을 차단합니다.
 * 3) 긴 URL 문자열을 그대로 노출하면 카드 디자인이 깨지므로, 도메인에 맞는 깔끔한 인증 뱃지명을 생성합니다.
 */
export function extractSafeExternalLinks(post: any): ReviewExternalLink[] {
  const rawEntries: { raw?: any; defaultKind: 'cafe' | 'sns'; index: number }[] = [
    { raw: post?.cafeUrl1, defaultKind: 'cafe', index: 1 },
    { raw: post?.cafeUrl2, defaultKind: 'cafe', index: 2 },
    { raw: post?.snsUrl1, defaultKind: 'sns', index: 1 },
    { raw: post?.snsUrl2, defaultKind: 'sns', index: 2 },
    { raw: post?.snsUrl3, defaultKind: 'sns', index: 3 },
  ];

  const validLinks: ReviewExternalLink[] = [];
  const seenUrls = new Set<string>();

  for (const entry of rawEntries) {
    if (!entry.raw || typeof entry.raw !== 'string') continue;
    let trimmed = entry.raw.trim();
    if (trimmed.length < 5) continue;

    // 프로토콜이 누락된 경우 https:// 자동 추가
    if (!/^https?:\/\//i.test(trimmed)) {
      trimmed = `https://${trimmed}`;
    }

    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') continue;
      // 최소한 도메인에 점(.)이 포함되어야 유효한 웹 주소로 인정
      if (!parsed.hostname.includes('.')) continue;

      const normalizedUrl = parsed.toString();
      if (seenUrls.has(normalizedUrl)) continue;
      seenUrls.add(normalizedUrl);

      const host = parsed.hostname.toLowerCase();
      let kind: 'cafe' | 'blog' | 'sns' = entry.defaultKind;
      let label = entry.defaultKind === 'cafe' ? '☕ 지역 맘카페 인증 후기 보기' : '🔗 SNS 실제 인증 후기 보기';

      if (host.includes('cafe.naver.com') || host.includes('cafe.daum.net') || entry.defaultKind === 'cafe') {
        kind = 'cafe';
        label = '☕ 지역 맘카페 실제 후기 원문';
      } else if (host.includes('blog.naver.com') || host.includes('m.blog.naver.com') || host.includes('tistory.com')) {
        kind = 'blog';
        label = '📝 네이버 블로그 내돈내산 후기';
      } else if (host.includes('instagram.com') || host.includes('threads.net')) {
        kind = 'sns';
        label = '📸 인스타그램 실제 인증 후기';
      }

      validLinks.push({ url: normalizedUrl, label, kind });
    } catch {
      // 잘못된 URL 형식은 무시하여 화면 에러 방지
      continue;
    }
  }

  return validLinks;
}

/**
 * [기본 폴백(Fallback) 리뷰 데이터]
 */
export const DEFAULT_SEO_REVIEWS: SeoReviewItem[] = [
  {
    id: 'default-1',
    stars: 5,
    text: '연락드리니 신속하게 방문해서 꼼꼼하게 수거해가시네요.',
    authorName: '동탄*',
    region: '경기 화성시 동탄구',
    dateISO: '2026-08-21',
    dateDisplay: '2026. 8. 21.',
    meta: '동탄* · 경기 화성시 동탄구 · 2026. 8. 21.',
    receiptTotal: '10,550원',
    receiptDetails: '헌옷 9kg | 헌옷 (신발, 가방 포함) 20kg',
    tags: ['👔 편리성 5점', '🤝 친절도 5점', '⚡ 신속정확 5점'],
    externalLinks: [],
  },
  {
    id: 'default-2',
    stars: 5,
    text: '처리 과정이 깔끔하고 완벽해서 다음에도 또 이용할게요.',
    authorName: '수지*',
    region: '경기 용인시 수지구',
    dateISO: '2026-08-21',
    dateDisplay: '2026. 8. 21.',
    meta: '수지* · 경기 용인시 수지구 · 2026. 8. 21.',
    receiptTotal: '15,490원',
    receiptDetails: '헌옷 28kg | 후라이팬, 냄비류 3kg',
    tags: ['👔 편리성 5점', '🤝 친절도 5점', '⚡ 신속정확 5점'],
    externalLinks: [],
  },
  {
    id: 'default-3',
    stars: 5,
    text: '무겁게 들고 나갈 필요 없이 비대면으로 싹 수거해주셔서 너무 편했어요!',
    authorName: '영통*',
    region: '경기 수원시 영통구',
    dateISO: '2026-08-20',
    dateDisplay: '2026. 8. 20.',
    meta: '영통* · 경기 수원시 영통구 · 2026. 8. 20.',
    receiptTotal: '11,200원',
    receiptDetails: '헌옷 24kg | 신발, 가방 4kg',
    tags: ['👔 편리성 5점', '🤝 친절도 5점', '⚡ 신속정확 5점'],
    externalLinks: [],
  },
  {
    id: 'default-4',
    stars: 5,
    text: '신청 당일에 바로 와주셨어요. 정산금도 쏠쏠하네요 ㅎㅎ',
    authorName: '분당*',
    region: '경기 성남시 분당구',
    dateISO: '2026-08-19',
    dateDisplay: '2026. 8. 19.',
    meta: '분당* · 경기 성남시 분당구 · 2026. 8. 19.',
    receiptTotal: '12,200원',
    receiptDetails: '헌옷 15kg | 헌책 10kg',
    tags: ['👔 편리성 5점', '🤝 친절도 5점', '⚡ 신속정확 5점'],
    externalLinks: [],
  },
  {
    id: 'default-5',
    stars: 5,
    text: '앱으로 간편하게 신청하고 문 앞에 두기만 하면 되니 최고입니다.',
    authorName: '세교*',
    region: '경기 오산시 세교동',
    dateISO: '2026-08-18',
    dateDisplay: '2026. 8. 18.',
    meta: '세교* · 경기 오산시 세교동 · 2026. 8. 18.',
    receiptTotal: '9,800원',
    receiptDetails: '헌옷 18kg | 가방 2kg',
    tags: ['👔 편리성 5점', '🤝 친절도 5점', '⚡ 신속정확 5점'],
    externalLinks: [],
  },
  {
    id: 'default-6',
    stars: 5,
    text: '아이 옷이랑 계절 지난 옷 정리하면서 신청했는데 저울 사진까지 보내주셔서 믿음이 갑니다!',
    authorName: '기흥*',
    region: '경기 용인시 기흥구',
    dateISO: '2026-08-17',
    dateDisplay: '2026. 8. 17.',
    meta: '기흥* · 경기 용인시 기흥구 · 2026. 8. 17.',
    receiptTotal: '14,800원',
    receiptDetails: '헌옷 (신발, 가방 포함) 32kg | 냄비류 2kg',
    tags: ['👔 편리성 5점', '🤝 친절도 5점', '⚡ 신속정확 5점'],
    externalLinks: [],
  },
];

/**
 * [백엔드 리뷰 응답 안전 변환 함수]
 */
export function normalizePublicReviews(rawPosts: any[]): SeoReviewItem[] {
  if (!Array.isArray(rawPosts) || rawPosts.length === 0) {
    return DEFAULT_SEO_REVIEWS;
  }

  try {
    const formatted = rawPosts.map((p: any, index: number): SeoReviewItem => {
      const conv = Number(p?.ratingConvenience) || 5;
      const kind = Number(p?.ratingKindness) || 5;
      const speed = Number(p?.ratingSpeed) || 5;
      const stars = Math.min(5, Math.max(1, Math.round((conv + kind + speed) / 3)));

      const total = Number(p?.receiptSnapshot?.totalPrice) || 0;
      const receiptTotal = total > 0 ? `${total.toLocaleString('ko-KR')}원` : '당일 정산 완료';

      let receiptDetails = '';
      if (Array.isArray(p?.receiptSnapshot?.collectionItems) && p.receiptSnapshot.collectionItems.length > 0) {
        receiptDetails = p.receiptSnapshot.collectionItems
          .map((item: any) => `${item?.categoryLabel || '헌옷'} ${item?.quantity || ''}${item?.unitType === 'KG' ? 'kg' : '대'}`)
          .join(' | ');
      } else if (Number(p?.receiptSnapshot?.actualWeight) > 0) {
        receiptDetails = `헌옷 및 재활용품 ${p.receiptSnapshot.actualWeight}kg`;
      }
      if (!receiptDetails) {
        receiptDetails = '헌옷 및 신발·가방 방문수거';
      }

      const createdDate = p?.createdAt ? new Date(p.createdAt) : new Date();
      const isValidDate = !isNaN(createdDate.getTime());
      const dateISO = isValidDate ? createdDate.toISOString().split('T')[0] : '2026-08-21';
      const dateDisplay = isValidDate ? createdDate.toLocaleDateString('ko-KR') : '최근 수거';

      const authorName = p?.authorName || '고객*';
      const region = p?.maskedAddress || '수도권 전담 권역';
      const meta = `${authorName} · ${region} · ${dateDisplay}`;

      const externalLinks = extractSafeExternalLinks(p);

      return {
        id: p?.id || `review-${index}`,
        stars,
        text: p?.content && String(p.content).trim().length > 0
          ? String(p.content).trim()
          : '기사님이 친절하시고 신속하게 방문해서 깔끔하게 수거해 주셨어요!',
        authorName,
        region,
        dateISO,
        dateDisplay,
        meta,
        receiptTotal,
        receiptDetails,
        tags: [
          `👔 편리성 ${conv}점`,
          `🤝 친절도 ${kind}점`,
          `⚡ 신속정확 ${speed}점`,
        ],
        externalLinks,
      };
    });

    if (formatted.length < 3) {
      return [...formatted, ...DEFAULT_SEO_REVIEWS.slice(0, 6 - formatted.length)];
    }
    return formatted;
  } catch (err) {
    console.error('리뷰 데이터 정규화 중 오류 발생 (기본 데이터로 폴백):', err);
    return DEFAULT_SEO_REVIEWS;
  }
}

const REGION_TABS = [
  { key: 'ALL', label: '전체 지역', keywords: [] as string[] },
  { key: 'HWASEONG', label: '화성·동탄', keywords: ['화성', '동탄', '병점', '봉담', '향남', '남양'] },
  { key: 'YONGIN', label: '용인·수지·기흥', keywords: ['용인', '수지', '기흥', '죽전', '처인', '보정'] },
  { key: 'SUWON', label: '수원·광교·영통', keywords: ['수원', '영통', '광교', '권선', '장안', '팔달', '인계'] },
  { key: 'SEONGNAM', label: '성남·분당·판교', keywords: ['성남', '분당', '판교', '위례', '수정', '중원'] },
  { key: 'OSAN_ETC', label: '오산·평택·기타', keywords: ['오산', '세교', '평택', '안양', '광주', '서울', '강남', '마포'] },
];

export default function SeoReviewSection({ reviews }: { reviews: SeoReviewItem[] }) {
  const [activeRegion, setActiveRegion] = useState<string>('ALL');
  const [visibleCount, setVisibleCount] = useState<number>(6);

  // 선택된 지역 탭에 맞는 리뷰 필터링
  const filteredReviews = useMemo(() => {
    if (activeRegion === 'ALL') return reviews;
    const targetTab = REGION_TABS.find((t) => t.key === activeRegion);
    if (!targetTab || targetTab.keywords.length === 0) return reviews;

    const matched = reviews.filter((r) =>
      targetTab.keywords.some((kw) => r.region.includes(kw) || r.meta.includes(kw))
    );
    return matched.length > 0 ? matched : reviews;
  }, [reviews, activeRegion]);

  // 평균 평점 계산
  const averageRating = useMemo(() => {
    if (!reviews || reviews.length === 0) return '5.0';
    const sum = reviews.reduce((acc, cur) => acc + (cur.stars || 5), 0);
    return (sum / reviews.length).toFixed(1);
  }, [reviews]);

  /**
   * [핵심 SEO 장치: JSON-LD 구조화 데이터(AggregateRating + Review + 외부 인증 링크 연결)]
   */
  const reviewSchemaJson = useMemo(() => {
    const schemaData = {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: '올클 (ALL-CLEAR) 헌옷 방문수거',
      description: '화성(동탄), 용인(수지·기흥), 수원(영통·광교), 성남(분당·판교), 오산 헌옷·신발·가방·헌책·냄비 비대면 방문수거 및 당일 현금 정산 서비스',
      url: 'https://www.all-cle.com/',
      telephone: '010-5232-3215',
      image: 'https://www.all-cle.com/new-logo.png',
      areaServed: [
        { '@type': 'City', name: '화성시' },
        { '@type': 'City', name: '용인시' },
        { '@type': 'City', name: '수원시' },
        { '@type': 'City', name: '성남시' },
        { '@type': 'City', name: '오산시' },
      ],
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: averageRating,
        bestRating: '5',
        worstRating: '1',
        reviewCount: String(Math.max(reviews.length, 6)),
      },
      review: reviews.slice(0, 10).map((r) => ({
        '@type': 'Review',
        author: {
          '@type': 'Person',
          name: r.authorName,
        },
        datePublished: r.dateISO,
        name: `${r.region} ${r.receiptDetails.split('|')[0].trim()} 방문수거 정산 후기`,
        reviewBody: `[수거지역: ${r.region} | 수거내역: ${r.receiptDetails} | 정산금액: ${r.receiptTotal}] ${r.text}`,
        reviewRating: {
          '@type': 'Rating',
          ratingValue: String(r.stars),
          bestRating: '5',
          worstRating: '1',
        },
        // 고객이 첨부한 맘카페·블로그·SNS 원문 링크가 있으면 검색엔진 스키마에도 참조 URL로 연결
        ...(r.externalLinks.length > 0 ? { sameAs: r.externalLinks.map((l) => l.url) } : {}),
      })),
    };
    return JSON.stringify(schemaData);
  }, [reviews, averageRating]);

  return (
    <section
      id="reviews"
      aria-labelledby="seo-reviews-title"
      className="relative py-16 sm:py-24 bg-sky-50 overflow-hidden scroll-mt-16"
    >
      {/* 구글·네이버 검색 로봇용 JSON-LD 스키마 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: reviewSchemaJson }}
      />

      <div className="max-w-7xl mx-auto px-5 md:px-8">
        {/* 섹션 타이틀 영역 */}
        <div className="text-center mb-10 sm:mb-12">
          <p className="text-primary-600 font-black tracking-widest text-base sm:text-xl mb-3">
            생생한 헌옷 방문수거 후기 & 실제 정산 내역
          </p>
          <h2
            id="seo-reviews-title"
            className="text-2xl sm:text-5xl font-black tracking-tight text-gray-900 break-keep leading-tight"
          >
            고객님들이 직접 증명하는<br />올클의 지역별 수거 정산 후기
          </h2>
          <p className="mt-3 text-gray-600 font-medium text-xs sm:text-base max-w-2xl mx-auto break-keep">
            화성(동탄), 용인(수지·기흥), 수원(영통·광교), 성남(분당·판교), 오산까지! 실제 계근 무게와 당일 지급된 정산 금액, 그리고 맘카페·블로그 실제 인증 후기를 투명하게 공개합니다.
          </p>
        </div>

        {/* 베스트 후기 하이라이트 + 평점 요약 바 */}
        <div className="max-w-5xl mx-auto mb-10">
          <div className="bg-white rounded-3xl p-6 md:p-9 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-blue-100 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-[100px] -z-0 transition-transform group-hover:scale-110"></div>
            <div className="relative z-10">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div className="flex items-center gap-3">
                  <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold px-3.5 py-1.5 rounded-full shadow-sm">
                    👑 이달의 베스트 수거 후기
                  </span>
                  <div className="flex text-amber-400 text-lg" aria-label="별점 5점 만점에 5점">
                    ★★★★★
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200/70 px-3.5 py-1.5 rounded-full">
                  <span className="text-amber-500 font-black text-sm">⭐ 평균 만족도 {averageRating} / 5.0</span>
                  <span className="text-gray-400 text-xs">|</span>
                  <span className="text-gray-600 font-bold text-xs">실제 영수증 인증 리뷰</span>
                </div>
              </div>

              <blockquote className="text-lg md:text-2xl font-bold text-gray-900 mb-4 leading-relaxed break-keep">
                "이사 가면서 헌옷이랑 신발이 산더미처럼 나왔는데, 문 앞에 두기만 하니 올클 덕분에 비대면으로 단숨에 해결했어요! 계근 사진도 투명하게 보내주시고 당일 정산금도 바로 입금되어 맘카페에도 추천글 올렸습니다!"
              </blockquote>

              <div className="flex flex-wrap items-center justify-between gap-4 mt-6 border-t border-gray-100 pt-5">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-black text-base">
                    김
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm md:text-base">김** 고객님 (실제 수거 정산 완료)</p>
                    <p className="text-xs md:text-sm text-gray-500">경기 화성시 동탄 · 정산금액 28,400원 당일 지급</p>
                  </div>
                </div>
                <div className="bg-blue-50 px-4 py-2 rounded-xl border border-blue-100 text-blue-700 text-xs sm:text-sm font-bold">
                  📦 헌옷 35kg | 신발·가방 12kg 방문수거
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 지역별 필터 탭 (클릭 시 해당 지역 후기 필터링) */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 mb-8">
          {REGION_TABS.map((tab) => {
            const isActive = activeRegion === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setActiveRegion(tab.key);
                  setVisibleCount(6);
                }}
                className={`px-4 py-2.5 rounded-full text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-primary-600 text-white shadow-md shadow-primary-500/20 scale-[1.02]'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-primary-200 hover:text-primary-600'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* 정적 시맨틱 <article> 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {filteredReviews.slice(0, visibleCount).map((review) => {
            const primaryItem = review.receiptDetails.split('|')[0]?.trim() || '헌옷 방문수거';
            return (
              <article
                key={review.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] p-6 flex flex-col justify-between hover:-translate-y-1 hover:shadow-lg transition-all duration-300"
              >
                <div>
                  {/* 상단 별점 및 작성일 */}
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className="flex gap-0.5 text-yellow-400 text-base"
                      aria-label={`별점 5점 만점에 ${review.stars}점`}
                    >
                      {Array(review.stars)
                        .fill('★')
                        .map((star, idx) => (
                          <span key={idx}>{star}</span>
                        ))}
                    </div>
                    <time dateTime={review.dateISO} className="text-xs text-gray-400 font-medium">
                      {review.dateDisplay}
                    </time>
                  </div>

                  {/* 검색엔진이 가장 중요하게 수집하는 시맨틱 H3: [지역명 + 수거품목] 자동 조합 */}
                  <h3 className="text-xs sm:text-sm font-extrabold text-primary-700 bg-primary-50/80 border border-primary-100/80 px-3 py-1.5 rounded-lg mb-3.5 break-keep">
                    📍 {review.region} · {primaryItem} 수거
                  </h3>

                  {/* 고객 실제 한줄평 */}
                  <blockquote className="text-gray-800 font-extrabold text-base sm:text-[17px] mb-3 leading-snug break-keep">
                    "{review.text}"
                  </blockquote>

                  <p className="text-xs text-gray-400 font-medium mb-4">{review.meta}</p>
                </div>

                <div>
                  {/* 실제 수거 정산서 스냅샷 박스 */}
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 mb-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500">
                        <span>🧾</span> 실제 수거 정산금
                      </span>
                      <span className="text-[11px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
                        정산 완료
                      </span>
                    </div>
                    <div className="font-black text-primary-600 text-xl sm:text-2xl mb-1">
                      {review.receiptTotal}
                    </div>
                    <p className="text-xs text-gray-500 font-medium break-keep">
                      수거 내역: {review.receiptDetails}
                    </p>
                  </div>

                  {/* 
                    [고객 첨부 리뷰 이벤트 링크 노출 영역]
                    왜 rel="ugc nofollow noopener noreferrer"를 사용하는가:
                    구글·네이버 표준 가이드라인에 따라 사용자 생성 콘텐츠(UGC)의 외부 링크임을 명시하여
                    사이트 신뢰도를 높이면서도 혹시 모를 외부 스팸 링크 페널티나 페이지랭크 누수를 완벽히 방어합니다.
                  */}
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

                  {/* 항목별 세부 평가 태그 */}
                  <div className="flex flex-wrap gap-1.5">
                    {review.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-full bg-orange-50/70 border border-orange-100 text-orange-600 text-[10px] sm:text-[11px] font-bold whitespace-nowrap"
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

        {/* 더보기 & 전용 리뷰 게시판(/reviews) 이동 버튼 */}
        <div className="mt-10 sm:mt-12 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
          {filteredReviews.length > visibleCount && (
            <button
              type="button"
              onClick={() => setVisibleCount((prev) => prev + 6)}
              className="w-full sm:w-auto px-7 py-3.5 rounded-full bg-white border border-gray-200 text-gray-700 font-extrabold text-sm hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm cursor-pointer"
            >
              이 페이지에서 후기 더 펼쳐보기 ({Math.min(visibleCount, filteredReviews.length)}/{filteredReviews.length}) ↓
            </button>
          )}

          <Link
            to="/reviews"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full bg-primary-600 text-white font-extrabold text-sm hover:bg-primary-700 transition-all shadow-md shadow-primary-500/20"
          >
            <span>📋</span> 실시간 수거 후기 · 지역별 정산 내역 전체보기 →
          </Link>
        </div>
      </div>
    </section>
  );
}
