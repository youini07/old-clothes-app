import React, { useEffect, useRef, useState } from 'react';

/**
 * 올클(ALL-CLEAR) 고객용 랜딩 페이지
 * - 푸른색(primary) 라이트 테마 + 대형 타이포그래피 + 스크롤 인터랙션
 * - 카카오 로그인이 최종 CTA
 */

const KAKAO_LOGIN_URL = `${import.meta.env.VITE_API_URL}/auth/kakao`;

// ===== 서비스 통계 수치 (실제 데이터로 업데이트하려면 여기만 수정) =====
const STATS = [
  { label: '올클 월간 평균 수거 무게', end: 50000, suffix: 'kg+' },
  { label: '월 평균 수거 완료', end: 800, suffix: '건+' },
];

const DUMMY_REVIEWS = [
  {
    stars: 5,
    text: "연락드리니 신속하게 방문해서 꼼꼼하게 수거해가시네요.",
    meta: "동탄* · 경기 화성시 동탄구 · 2026. 8. 21.",
    receiptTotal: "10,550원",
    receiptDetails: "헌옷 9kg | 헌옷 (신발, 가방 포함) 20kg",
    tags: ["👔 편리성 5점", "🤝 친절도 5점", "⚡ 신속정확 5점"]
  },
  {
    stars: 5,
    text: "처리 과정이 깔끔하고 완벽해서 다음에도 또 이용할게요.",
    meta: "수지* · 용인시 수지구 · 2026. 8. 21.",
    receiptTotal: "15,490원",
    receiptDetails: "헌옷 28kg | 후라이팬, 냄비류 3kg",
    tags: ["👔 편리성 5점", "🤝 친절도 5점", "⚡ 신속정확 5점"]
  },
  {
    stars: 5,
    text: "무겁게 들고 나갈 필요 없이 비대면으로 싹 수거해주셔서 너무 편했어요!",
    meta: "강남* · 서울 강남구 · 2026. 8. 20.",
    receiptTotal: "8,400원",
    receiptDetails: "헌옷 21kg",
    tags: ["👔 편리성 5점", "🤝 친절도 5점", "⚡ 신속정확 5점"]
  },
  {
    stars: 5,
    text: "신청 당일에 바로 와주셨어요. 정산금도 쏠쏠하네요 ㅎㅎ",
    meta: "분당* · 성남시 분당구 · 2026. 8. 19.",
    receiptTotal: "12,200원",
    receiptDetails: "헌옷 15kg | 헌책 10kg",
    tags: ["👔 편리성 5점", "🤝 친절도 5점", "⚡ 신속정확 5점"]
  },
  {
    stars: 5,
    text: "앱으로 간편하게 신청하고 문 앞에 두기만 하면 되니 최고입니다.",
    meta: "마포* · 서울 마포구 · 2026. 8. 18.",
    receiptTotal: "9,800원",
    receiptDetails: "헌옷 18kg | 가방 2kg",
    tags: ["👔 편리성 5점", "🤝 친절도 5점", "⚡ 신속정확 5점"]
  }
];




// 스크롤 진입 시 요소를 서서히 등장시키는 옵저버
function useRevealObserver() {
  useEffect(() => {
    const els = document.querySelectorAll('.reveal');
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

// 화면에 보일 때 0부터 end까지 카운트업되는 숫자
function CountUp({ end, suffix = '' }: { end: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !startedRef.current) {
          startedRef.current = true;
          const duration = 1800;
          const startTime = performance.now();
          const tick = (now: number) => {
            const progress = Math.min((now - startTime) / duration, 1);
            // easeOutCubic
            const eased = 1 - Math.pow(1 - progress, 3);
            setValue(Math.round(end * eased));
            if (progress < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [end]);

  return (
    <span ref={ref}>
      {value.toLocaleString('ko-KR')}
      <span className="text-primary-500 ml-1">{suffix}</span>
    </span>
  );
}




// CSS로 그린 스마트폰 목업 프레임 (Galaxy Style, 16:9 Ratio)
function PhoneMockup({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-[270px] sm:w-[300px] mx-auto">
      {/* 갤럭시에 가까운 각진 메탈릭 프레임 */}
      <div className="rounded-[1.75rem] bg-[#1c1c1e] p-[4px] shadow-[0_30px_60px_-15px_rgba(37,99,235,0.3)] ring-1 ring-gray-900/10 border-2 border-[#3a3a3c]">
        <div className="rounded-[1.6rem] bg-white overflow-hidden relative aspect-[9/16] flex flex-col">
          
          {/* 펀치홀 카메라 */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-black rounded-full z-50"></div>
          
          {/* 안드로이드 상태바 */}
          <div className="flex items-center justify-between px-5 pt-2 pb-1 text-[10px] font-bold text-gray-800 relative z-40 shrink-0">
            <span>12:45</span>
            <span className="flex items-center gap-1 tracking-tight">
              <span className="font-sans">5G</span>
              <span>📶</span>
              <span className="text-[12px]">🔋</span>
            </span>
          </div>
          
          {/* 화면 컨텐츠 */}
          <div className="flex-1 overflow-hidden relative bg-white">{children}</div>
          
          {/* 안드로이드 제스처 힌트바 */}
          <div className="pb-1.5 pt-1.5 flex justify-center bg-white relative z-40 shrink-0">
            <div className="w-12 h-1 rounded-full bg-gray-300"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewCard({ review }: { review: typeof DUMMY_REVIEWS[0] }) {
  return (
    <div className="w-[320px] md:w-[400px] shrink-0 bg-white rounded-2xl border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] p-6 md:p-8 flex flex-col mx-3 md:mx-4 hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
      <div className="flex gap-1 text-yellow-400 text-lg mb-4">
        {Array(review.stars).fill('★').map((s, i) => <span key={i}>{s}</span>)}
      </div>
      <p className="text-gray-800 font-extrabold text-base md:text-lg mb-3 leading-snug">
        "{review.text}"
      </p>
      <p className="text-xs text-gray-400 font-medium mb-6">{review.meta}</p>
      
      <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 mb-5">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500 mb-2">
          <span>🧾</span> 수거 정산서
        </div>
        <div className="font-black text-primary-600 text-xl md:text-2xl mb-1">{review.receiptTotal}</div>
        <div className="text-[10px] md:text-xs text-gray-400 font-medium truncate">{review.receiptDetails}</div>
      </div>
      
      <div className="flex flex-wrap gap-1.5 mt-auto">
        {review.tags.map((tag, i) => (
          <span key={i} className="px-2.5 py-1 rounded-full bg-orange-50/50 border border-orange-100 text-orange-600 text-[10px] font-bold whitespace-nowrap">
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Landing() {
  const [scrolled, setScrolled] = useState(false);
  const [reviews, setReviews] = useState(DUMMY_REVIEWS);
  const extendedReviews = [...reviews, ...reviews];

  useRevealObserver();

  // 헤더 배경 활성화 감지
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // 실제 고객 후기 불러오기
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/board/public/reviews?limit=15`)
      .then(res => res.json())
      .then(data => {
        if (data && data.posts && data.posts.length > 0) {
          const formatted = data.posts.map((p: any) => {
            const stars = Math.round(((p.ratingConvenience || 5) + (p.ratingKindness || 5) + (p.ratingSpeed || 5)) / 3);
            const total = p.receiptSnapshot?.totalPrice || 0;
            const receiptTotal = `${total.toLocaleString()}원`;
            
            let receiptDetails = '';
            if (p.receiptSnapshot?.collectionItems) {
              receiptDetails = p.receiptSnapshot.collectionItems.map((item: any) => 
                `${item.categoryLabel} ${item.quantity}${item.unitType === 'KG' ? 'kg' : '대'}`
              ).join(' | ');
            }
            if (!receiptDetails) receiptDetails = "헌옷 및 기타 재활용품 수거";

            const tags = [
              `👔 편리성 ${p.ratingConvenience || 5}점`,
              `🤝 친절도 ${p.ratingKindness || 5}점`,
              `⚡ 신속정확 ${p.ratingSpeed || 5}점`
            ];

            const dateStr = new Date(p.createdAt).toLocaleDateString('ko-KR');
            const meta = `${p.authorName} · ${p.maskedAddress || '지역 비공개'} · ${dateStr}`;

            return {
              stars: stars || 5,
              text: p.content || "정말 편리하고 깔끔하게 수거해주셨어요!",
              meta,
              receiptTotal,
              receiptDetails,
              tags
            };
          });
          setReviews(formatted);
        }
      })
      .catch(err => console.error('Failed to fetch public reviews:', err));
  }, []);


  return (
    <div className="bg-[#F7F8FC] text-gray-900 font-sans">
      {/* ================= 헤더 ================= */}
      <header
        className={`sticky top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled ? 'bg-white/95 backdrop-blur-md shadow-md shadow-primary-900/5' : 'bg-white shadow-sm'
        }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between px-5 md:px-8 h-16">
          <a href="#top" className="flex items-baseline gap-2">
            <span className="text-2xl font-black tracking-tight text-primary-600">올클</span>
            <span className="text-2xl font-medium tracking-tight text-gray-900 hidden sm:block">OLD CLOTHES, ALL CLEAR</span>
          </a>

          <div className="flex items-center gap-3 md:gap-8">
            <nav className="hidden lg:flex items-center gap-8 text-base font-bold text-gray-600">
              <a href="#top" className="hover:text-primary-600 transition-colors">수거 신청</a>
              <a href="#how" className="hover:text-primary-600 transition-colors">서비스 소개</a>
              <a href="#trust" className="hover:text-primary-600 transition-colors">안심 수거</a>
              <a href="#reviews" className="hover:text-primary-600 transition-colors">고객 후기</a>
              <a href="#stats" className="hover:text-primary-600 transition-colors">올클 성과</a>
            </nav>

            <a
              href="#eco"
              className="px-3 py-2 md:px-5 md:py-2.5 text-xs md:text-base font-bold rounded-full bg-green-50 border border-green-200 text-green-700 hover:bg-green-100 transition-colors flex items-center gap-1 md:gap-1.5"
            >
              올클의 환경 가치 <span className="text-sm md:text-base">🌿</span>
            </a>
          </div>
        </div>
      </header>

      {/* ================= 히어로 ================= */}
      <section id="top" className="relative min-h-[90svh] flex flex-col justify-center overflow-hidden pb-24">
        {/* 배경 그라데이션 + 워터마크 */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 90% 70% at 30% 20%, #dbeafe 0%, #F7F8FC 55%), radial-gradient(ellipse 70% 60% at 80% 90%, #e0f2fe 0%, transparent 60%)',
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden pb-24">
          <span className="text-[22vw] leading-none font-black text-[rgba(37,99,235,0.08)] whitespace-nowrap">
            ALLCLEAR
          </span>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto w-full px-5 md:px-8 pt-4 pb-10 flex flex-col">
          <div className="flex-1 flex flex-col items-center text-center">
            <h1 className="font-black leading-[1.1] tracking-tighter text-[11vw] sm:text-7xl md:text-8xl lg:text-[7.5rem] uppercase w-full">
              <span className="block reveal text-gray-900 transition-colors hover:text-gray-700">
                Old Clothes,
              </span>
              <span className="block reveal reveal-delay-1 text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-sky-400 mt-1 md:mt-2">
                All Clear.
              </span>
            </h1>
          </div>

          <div className="mt-12 md:mt-16 flex flex-col md:flex-row md:items-end md:justify-between w-full gap-8">
            <p className="reveal reveal-delay-2 text-lg sm:text-xl md:text-2xl text-gray-600 font-medium max-w-2xl leading-relaxed">
              문 앞에 헌옷을 담아두기만 하면 모든 것이 <strong className="text-primary-600 font-black tracking-tight">ALL CLEAR!</strong>
              <br />
              투명하고 안전한 비대면 수거부터 
              <br />
              기분 좋은 정산까지 완벽하게 해결해 드립니다.
            </p>

            <div className="reveal reveal-delay-3 flex flex-col sm:flex-row items-center gap-4 shrink-0">
              <a
                href={KAKAO_LOGIN_URL}
                className="flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-[#FEE500] text-yellow-950 text-base font-extrabold shadow-[0_8px_30px_rgba(254,229,0,0.25)] hover:brightness-95 active:scale-95 transition-all w-full sm:w-auto"
              >
                💬 카카오로 3초만에 시작
              </a>
              <a
                href="#how"
                className="flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-white border border-gray-200 text-gray-700 text-base font-bold hover:bg-gray-50 active:scale-95 shadow-sm transition-all w-full sm:w-auto"
              >
                자세히 알아보기
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ================= 이용 방법 ================= */}
      <section 
        id="how" 
        className="relative min-h-[100svh] flex items-center scroll-mt-16 py-24 bg-cover bg-center bg-no-repeat overflow-hidden"
        style={{ backgroundImage: "url('/how-bg.jpg')" }}
      >
        <div className="absolute inset-0 bg-white/30"></div>
        <div className="relative z-10 max-w-7xl mx-auto w-full px-5 md:px-8 grid md:grid-cols-2 gap-14 items-center">
          <div className="order-2 md:order-1">
            <p className="reveal text-primary-600 font-black tracking-widest text-lg sm:text-xl mb-4">헌옷 수거 서비스</p>
            <h2 className="reveal reveal-delay-1 text-3xl sm:text-5xl font-black leading-tight tracking-tight text-gray-900">
              신청부터 정산까지,<br />
              완벽하게 ALL CLEAR!
            </h2>
            <p className="reveal reveal-delay-2 mt-6 text-gray-600 font-medium leading-relaxed sm:text-lg">
              무겁게 들고 나갈 필요 없이 문 앞에만 두세요.
              <br className="hidden sm:block" />
              올클이 알아서 수거하고, 기분 좋은 정산금으로 돌려드립니다.
            </p>

            <ol className="mt-10 space-y-5">
              {[
                { icon: '📱', title: '카카오로 간편 신청', desc: '로그인 후 주소와 수거 희망일만 선택하면 끝' },
                { icon: '📦', title: '문 앞에 담아두기', desc: '벌커박스·가방·봉투, 무엇에 담든 상관없어요' },
                { icon: '💰', title: '수거 후 바로 정산', desc: '무게 측정 결과를 알림톡으로 받아보고 정산받으세요' },
              ].map((step, i) => (
                <li key={i} className={`reveal reveal-delay-${i + 1} flex items-start gap-4`}>
                  <span className="shrink-0 w-12 h-12 rounded-2xl bg-primary-50 border border-primary-100 flex items-center justify-center text-2xl shadow-sm text-primary-600">
                    {step.icon}
                  </span>
                  <div>
                    <p className="font-extrabold text-base text-gray-900">{step.title}</p>
                    <p className="text-sm text-gray-500 font-medium mt-1">{step.desc}</p>
                  </div>
                </li>
              ))}
            </ol>

            <a
              href={KAKAO_LOGIN_URL}
              className="reveal reveal-delay-3 inline-block mt-10 px-8 py-4 rounded-full bg-primary-600 text-white shadow-lg shadow-primary-600/30 font-extrabold hover:bg-primary-700 active:scale-95 transition-all"
            >
              수거신청 하러가기
            </a>
          </div>

          <div className="reveal reveal-delay-2 block mt-12 md:mt-0">
            <PhoneMockup>
              <div className="px-5 py-4 text-left bg-white h-full overflow-hidden flex flex-col">
                <div className="flex items-center gap-2 text-gray-500 mb-3">
                  <span className="text-lg leading-none">‹</span>
                  <span className="text-[11px] font-medium">대시보드로 돌아가기</span>
                </div>
                
                <h3 className="text-lg font-black text-gray-900 tracking-tight">헌옷 수거 신청</h3>
                <p className="text-[10px] text-gray-500 font-medium mt-1 mb-5">방문하실 주소와 희망 일정을 입력해주세요.</p>

                <div className="space-y-4 overflow-y-auto pb-6 no-scrollbar">
                  {/* 이름 */}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-700 mb-1.5">이름</label>
                    <div className="px-3 py-2.5 rounded-lg border border-gray-200 text-[11px] font-medium text-gray-900">
                      홍길동
                    </div>
                  </div>

                  {/* 연락처 */}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-700 mb-1.5">연락처</label>
                    <div className="px-3 py-2.5 rounded-lg border border-gray-200 text-[11px] font-medium text-gray-900">
                      010-1234-5678
                    </div>
                  </div>

                  {/* 방문 주소 */}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-700 mb-1.5">방문 주소</label>
                    <div className="flex gap-2 mb-2">
                      <div className="px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-[11px] font-medium text-gray-900 w-20 text-center">
                        06236
                      </div>
                      <div className="flex-1 py-2.5 rounded-lg bg-primary-600 text-white text-[11px] font-bold text-center shadow-sm">
                        주소 찾기
                      </div>
                    </div>
                    <div className="px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-[11px] font-medium text-gray-900 mb-2">
                      서울특별시 강남구 테헤란로 123
                    </div>
                    <div className="px-3 py-2.5 rounded-lg border border-gray-200 text-[11px] font-medium text-gray-900">
                      올클타워 101호
                    </div>
                  </div>

                  {/* 무게 */}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-700 mb-1.5">대략적인 헌옷 무게 (kg)</label>
                    <div className="px-3 py-2.5 rounded-lg border border-gray-200 text-[11px] font-medium text-gray-400">
                      예: 20 (숫자만 입력)
                    </div>
                  </div>
                </div>
              </div>
            </PhoneMockup>
          </div>
        </div>
      </section>

      {/* ================= 안심 & 맞춤 수거 ================= */}
      <section 
        id="trust" 
        className="relative min-h-[100svh] flex items-center scroll-mt-16 py-24 bg-cover bg-center bg-no-repeat overflow-hidden"
        style={{ backgroundImage: "url('/trust-bg.jpg')" }}
      >
        <div className="absolute inset-0 bg-white/30"></div>
        <div className="relative z-10 max-w-7xl mx-auto w-full px-5 md:px-8 grid md:grid-cols-2 gap-14 items-center">
          <div className="reveal block order-2 md:order-1 mt-12 md:mt-0">
            <PhoneMockup>
              <div className="px-5 py-5 text-left h-full flex flex-col bg-[#F7F8FC] overflow-y-auto no-scrollbar">
                <p className="text-[13px] font-black text-gray-900 mb-4 tracking-tight">최근 신청 내역</p>
                
                <div className="bg-white rounded-[1.25rem] p-4 shadow-sm border border-gray-100">
                  <div className="flex justify-between items-center mb-3">
                    <span className="px-3 py-1 bg-green-100 text-green-700 text-[10px] font-extrabold rounded-full">수거 완료</span>
                    <span className="text-[10px] text-gray-400 font-medium">2026. 6. 27. 신청</span>
                  </div>
                  <h4 className="text-sm font-black text-gray-900 mb-1 tracking-tight truncate">서울특별시 강남구 테헤란로 123</h4>
                  <p className="text-[11px] text-gray-500 font-medium mb-4">희망일: 2026. 6. 29.</p>
                  
                  <div className="bg-gray-50 rounded-xl p-3.5 mb-4">
                    <p className="text-[11px] font-extrabold text-gray-800 mb-3 flex items-center gap-1"><span>🧾</span> 수거 정산서</p>
                    <div className="space-y-2.5 text-[11px]">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 font-bold">헌옷 <span className="text-gray-400 text-[9px] font-medium ml-1">20kg × 400원</span></span>
                        <span className="font-black text-gray-900">8,000원</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 font-bold">후라이팬, 냄비류 <span className="text-gray-400 text-[9px] font-medium ml-1">20kg × 300원</span></span>
                        <span className="font-black text-gray-900">6,000원</span>
                      </div>
                      <div className="pt-3 border-t border-gray-200 flex justify-between items-center mt-3">
                        <span className="font-extrabold text-gray-900">합계</span>
                        <span className="font-black text-green-600 text-sm">14,000원</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] font-extrabold text-gray-800 mb-3 flex items-center gap-1"><span>📸</span> 수거 증빙 사진</p>
                    <div className="flex gap-2.5">
                      <div className="flex flex-col items-center gap-1.5 flex-1">
                        <div className="w-full aspect-square bg-blue-50 rounded-xl flex items-center justify-center text-3xl border border-blue-100 shadow-sm">📦</div>
                        <span className="text-[9px] font-bold text-gray-500">고객 포장</span>
                      </div>
                      <div className="flex flex-col items-center gap-1.5 flex-1">
                        <div className="w-full aspect-square bg-indigo-50 rounded-xl flex items-center justify-center text-3xl border border-indigo-100 shadow-sm">👕</div>
                        <span className="text-[9px] font-bold text-gray-500">헌옷, 신발</span>
                      </div>
                      <div className="flex flex-col items-center gap-1.5 flex-1">
                        <div className="w-full aspect-square bg-orange-50 rounded-xl flex items-center justify-center text-3xl border border-orange-100 shadow-sm">🍳</div>
                        <span className="text-[9px] font-bold text-gray-500">후라이팬, 냄비</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </PhoneMockup>
          </div>

          <div className="order-1 md:order-2">
            <p className="reveal text-primary-600 font-black tracking-widest text-lg sm:text-xl mb-4">맞춤 & 안심 수거</p>
            <h2 className="reveal reveal-delay-1 text-3xl sm:text-5xl font-black leading-tight tracking-tight text-gray-900">
              원하는 날짜에,<br />
              믿을 수 있게
            </h2>
            <p className="reveal reveal-delay-2 mt-6 text-gray-600 font-medium leading-relaxed">
              이삿날처럼 <strong>꼭 그날 수거가 필요한 경우</strong>, 앱에서 직접 수거일을 확정할 수 있어요.
              <br className="hidden sm:block" />
              또한 비대면 수거를 하더라도 기사님이 <strong>현장 증빙 사진</strong>을 남겨주어, 누락 없이 투명하고 신뢰감 있는 정산이 가능합니다.
            </p>

            <div className="reveal reveal-delay-2 mt-10 grid grid-cols-2 gap-4 max-w-md">
              <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
                <p className="text-2xl mb-1">📅</p>
                <p className="font-extrabold text-sm text-gray-900">수거일 지정</p>
                <p className="text-xs text-gray-500 font-medium mt-1">원하는 날짜로 확정 가능</p>
              </div>
              <div className="rounded-2xl bg-primary-50 border border-primary-200 shadow-sm p-5">
                <p className="text-2xl mb-1">📸</p>
                <p className="font-extrabold text-sm text-primary-900">투명한 증빙</p>
                <p className="text-xs text-gray-500 font-medium mt-1">현장 사진으로 안심 확인</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= 고객 후기 (Marquee) ================= */}
      <section id="reviews" className="relative py-24 bg-sky-50 overflow-hidden scroll-mt-16">
        <div className="max-w-7xl mx-auto px-5 md:px-8 mb-12 text-center">
          <p className="reveal text-primary-600 font-black tracking-widest text-lg sm:text-xl mb-3">생생한 수거 후기</p>
          <h2 className="reveal reveal-delay-1 text-3xl sm:text-5xl font-black tracking-tight text-gray-900">
            고객님들이 직접 증명하는<br />올클의 만족도
          </h2>
        </div>

        <div className="relative mt-16 max-w-[100vw]">
          {/* 흐린 그라데이션 오버레이 (좌우) - 스크롤 페이드 효과 */}
          <div className="absolute left-0 top-0 bottom-0 w-12 md:w-32 bg-gradient-to-r from-sky-50 to-transparent z-10 pointer-events-none"></div>
          <div className="absolute right-0 top-0 bottom-0 w-12 md:w-32 bg-gradient-to-l from-sky-50 to-transparent z-10 pointer-events-none"></div>

          <div className="reveal reveal-delay-2 relative">
            <div className="flex w-max animate-marquee hover:[animation-play-state:paused] group cursor-grab active:cursor-grabbing pb-8 pt-4">
              {/* 첫 번째 세트 */}
              <div className="flex">
                {extendedReviews.map((review, i) => (
                  <ReviewCard key={i} review={review} />
                ))}
              </div>
              {/* 두 번째 세트 (무한 루프용 동일 구성) */}
              <div className="flex">
                {extendedReviews.map((review, i) => (
                  <ReviewCard key={`dup-${i}`} review={review} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= 리클 성과 (통계) ================= */}
      <section id="stats" className="relative min-h-[100svh] flex items-center scroll-mt-16 py-24 overflow-hidden bg-white">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 50% 40%, #eff6ff 0%, #ffffff 70%)',
          }}
        />
        <div className="absolute inset-0 pointer-events-none select-none flex items-center justify-center overflow-hidden">
          <span className="text-[26vw] font-black text-[rgba(37,99,235,0.06)] whitespace-nowrap">
            ALLCLEAR
          </span>
        </div>

        <div className="relative z-10 max-w-5xl mx-auto w-full px-5 text-center">
          <p className="reveal text-primary-700 font-bold text-lg md:text-2xl">{STATS[0].label}</p>
          <div className="reveal reveal-delay-1 mt-4 font-black tracking-tight leading-none text-5xl sm:text-7xl md:text-8xl text-gray-900">
            <CountUp end={STATS[0].end} suffix={STATS[0].suffix} />
          </div>

          <div className="reveal reveal-delay-2 mt-16 flex justify-center max-w-xs mx-auto">
            {STATS.slice(1).map((s, i) => (
              <div key={i} className="w-full rounded-2xl bg-white border border-primary-100 shadow-sm p-6">
                <p className="text-3xl md:text-4xl font-black text-gray-900">
                  <CountUp end={s.end} suffix={s.suffix} />
                </p>
                <p className="mt-2 text-sm text-gray-500 font-bold">{s.label}</p>
              </div>
            ))}
          </div>

          <a
            href="#eco"
            className="reveal reveal-delay-3 inline-block mt-14 px-10 py-4 rounded-full bg-primary-600 text-white shadow-lg shadow-primary-600/30 font-extrabold hover:bg-primary-700 active:scale-95 transition-all"
          >
            지금 바로 수거 신청하기
          </a>
        </div>
      </section>

      {/* ================= 환경 가치 & 최종 CTA + 푸터 ================= */}
      <footer 
        id="eco"
        className="relative pt-32 pb-12 text-center border-t border-gray-200 bg-cover bg-center bg-no-repeat overflow-hidden"
        style={{ backgroundImage: "url('/eco-bg.jpg')" }}
      >
        <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px]"></div>
        
        <div className="relative z-10 max-w-4xl mx-auto px-5 mb-24">
          <span className="reveal inline-block py-1.5 px-4 rounded-full bg-primary-50 text-primary-700 text-sm font-extrabold mb-6 border border-primary-200 shadow-sm">
            재활용의 가치 🌿
          </span>
          <h2 className="reveal reveal-delay-1 text-4xl sm:text-6xl md:text-7xl font-black tracking-tight leading-tight text-gray-900">
            지구를 구하는 의류 수거, <br />
            비우는 기쁨과 <br />
            채워지는 <span className="text-primary-600">환경 가치</span>
          </h2>
          <p className="reveal reveal-delay-2 mt-8 text-lg sm:text-xl text-gray-700 font-medium leading-relaxed max-w-2xl mx-auto">
            우리가 쉽게 사고 버리는 옷들이 사실 엄청난 자원과 에너지를 소모한다는 사실, 알고 계셨나요? 
            올클과 함께 옷장을 비우는 순간, 지구를 위한 위대한 변화가 시작됩니다.
          </p>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-5 md:px-8 text-left mb-24">
          <div className="text-center mb-16">
            <h3 className="reveal text-3xl sm:text-4xl font-black tracking-tight text-gray-900">
              옷 한 벌 재활용이 만드는 <span className="text-green-600">놀라운 변화</span>
            </h3>
            <p className="reveal reveal-delay-1 mt-4 text-gray-500 font-medium text-lg">
              신뢰할 수 있는 환경 연구 결과를 바탕으로 한 실제 수치입니다.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
            {/* 데이터 카드 1 */}
            <div className="reveal reveal-delay-1 bg-white/70 backdrop-blur-md rounded-3xl p-8 sm:p-10 border border-gray-100 shadow-sm hover:-translate-y-1 transition-transform">
              <div className="text-5xl mb-6">💧</div>
              <h4 className="text-2xl font-black text-gray-900 mb-3">물 2,700 리터 절약</h4>
              <p className="text-gray-600 font-medium leading-relaxed mb-6">
                티셔츠 한 벌을 새로 생산하는 데는 무려 <strong>2,700리터</strong>의 물이 소비됩니다. 이는 한 사람이 약 <strong>2.5년 동안 마실 수 있는 막대한 양의 물</strong>입니다. 옷을 버리지 않고 재활용하는 것만으로도 수자원 고갈을 막을 수 있습니다.
              </p>
              <p className="text-xs text-gray-400 font-bold">* 세계자연기금(WWF) 통계 기준</p>
            </div>

            {/* 데이터 카드 2 */}
            <div className="reveal reveal-delay-2 bg-white/70 backdrop-blur-md rounded-3xl p-8 sm:p-10 border border-gray-100 shadow-sm hover:-translate-y-1 transition-transform">
              <div className="text-5xl mb-6">🌲</div>
              <h4 className="text-2xl font-black text-gray-900 mb-3">탄소 배출 19.5kg 감축</h4>
              <p className="text-gray-600 font-medium leading-relaxed mb-6">
                중고 의류 한 벌을 새 옷 대신 입을 경우 평균 <strong>19.5kg의 온실가스를 감축</strong>할 수 있습니다. 이는 <strong>30년생 소나무 약 3그루가 1년 내내 흡수하는 탄소량</strong>과 맞먹는 훌륭한 환경 보호 효과입니다.
              </p>
              <p className="text-xs text-gray-400 font-bold">* 영국 랩(WRAP) 글로벌 환경 연구 기준</p>
            </div>

            {/* 데이터 카드 3 */}
            <div className="reveal reveal-delay-1 bg-white/70 backdrop-blur-md rounded-3xl p-8 sm:p-10 border border-gray-100 shadow-sm hover:-translate-y-1 transition-transform">
              <div className="text-5xl mb-6">⏳</div>
              <h4 className="text-2xl font-black text-gray-900 mb-3">탄소 발자국 25% 감소</h4>
              <p className="text-gray-600 font-medium leading-relaxed mb-6">
                현재 가지고 있는 의류의 수명을 <strong>단 1년만 연장</strong>해도 의류 산업이 발생시키는 <strong>탄소 발자국을 약 25% 획기적으로 줄일 수 있습니다.</strong> 올클을 통한 재활용은 옷의 수명을 연장하는 가장 확실한 방법입니다.
              </p>
              <p className="text-xs text-gray-400 font-bold">* 글로벌 패션 아젠다(GFA) 보고서</p>
            </div>

            {/* 데이터 카드 4 */}
            <div className="reveal reveal-delay-2 bg-white/70 backdrop-blur-md rounded-3xl p-8 sm:p-10 border border-gray-100 shadow-sm hover:-translate-y-1 transition-transform">
              <div className="text-5xl mb-6">🔥</div>
              <h4 className="text-2xl font-black text-gray-900 mb-3">국가적 폐기물 비용 절감</h4>
              <p className="text-gray-600 font-medium leading-relaxed mb-6">
                대한민국에서는 <strong>매년 약 80만 톤 이상의 폐의류</strong>가 쏟아집니다. 재활용되지 못한 옷들은 소각 및 매립되며 치명적인 유독가스를 뿜어냅니다. 올클 수거 서비스는 막대한 환경 처리 비용과 대기 오염을 근본적으로 막습니다.
              </p>
              <p className="text-xs text-gray-400 font-bold">* 환경부 전국 폐기물 통계</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 pb-0 pt-8 bg-white/30 backdrop-blur-sm rounded-t-[3rem] mx-4 sm:mx-10 border-t border-x border-white/50 shadow-[0_-10px_30px_rgba(0,0,0,0.02)]">
          <p className="reveal text-gray-600 font-bold text-lg mb-6">
            카카오 로그인으로 3초면 충분해요.
          </p>
          <a
            href={KAKAO_LOGIN_URL}
            className="reveal reveal-delay-1 inline-flex items-center gap-2 px-10 py-5 rounded-full bg-[#FEE500] text-yellow-950 text-lg font-extrabold shadow-[0_8px_30px_rgba(254,229,0,0.25)] hover:brightness-95 active:scale-95 transition-all"
          >
            💬 카카오로 시작하기
          </a>
          <div className="reveal reveal-delay-2 mt-12 mb-8 space-y-2 text-xs text-gray-400 font-medium">
            <p>상호명 : 올클(ALL-CLEAR)</p>
            <p>Copyright © 올클. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
