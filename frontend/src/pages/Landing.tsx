import React, { useEffect, useRef, useState } from 'react';
import { Menu, X } from 'lucide-react';

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
    <div className="relative flex justify-center items-center w-[130px] h-[230px] sm:w-[300px] sm:h-auto mx-auto shrink-0">
      {/* 모바일에서는 absolute & scale 로 작게 렌더링하여 영역을 맞춤 */}
      <div className="absolute sm:relative transform scale-[0.48] sm:scale-100 origin-center sm:origin-auto w-[270px] sm:w-[300px]">
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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
        className={`hidden sm:block sticky top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled ? 'bg-white/95 backdrop-blur-md shadow-md shadow-primary-900/5' : 'bg-white shadow-sm'
        }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between px-5 md:px-8 h-16 relative">
          <a href="#top" className="flex items-baseline gap-2 z-50" onClick={() => setIsMobileMenuOpen(false)}>
            <span className="text-2xl font-black tracking-tight text-primary-600">올클</span>
            <span className="text-2xl font-medium tracking-tight text-gray-900 hidden sm:block">OLD CLOTHES, ALL CLEAR</span>
          </a>

          <div className="flex items-center gap-3 md:gap-8 z-50">
            {/* 데스크탑 네비게이션 */}
            <nav className="hidden lg:flex items-center gap-8 text-base font-bold text-gray-600">
              <a href="#top" className="hover:text-primary-600 transition-colors">수거 신청</a>
              <a href="#how" className="hover:text-primary-600 transition-colors">서비스 소개</a>
              <a href="#trust" className="hover:text-primary-600 transition-colors">안심 수거</a>
              <a href="#reviews" className="hover:text-primary-600 transition-colors">고객 후기</a>
              <a href="#stats" className="hover:text-primary-600 transition-colors">올클 성과</a>
            </nav>

            <a
              href="#eco"
              className="hidden lg:flex px-5 py-2.5 font-bold rounded-full bg-green-50 border border-green-200 text-green-700 hover:bg-green-100 transition-colors items-center gap-1.5"
            >
              올클의 환경 가치 <span className="text-base">🌿</span>
            </a>

            {/* 모바일 햄버거 메뉴 버튼 */}
            <button 
              className="lg:hidden p-1.5 text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* 모바일 전체화면 메뉴 */}
        {isMobileMenuOpen && (
          <div className="lg:hidden absolute top-16 inset-x-0 bg-white border-b border-gray-100 shadow-xl flex flex-col px-5 py-6 gap-6 z-40">
            <nav className="flex flex-col gap-6 text-lg font-bold text-gray-800">
              <a href="#top" onClick={() => setIsMobileMenuOpen(false)}>수거 신청</a>
              <a href="#how" onClick={() => setIsMobileMenuOpen(false)}>서비스 소개</a>
              <a href="#trust" onClick={() => setIsMobileMenuOpen(false)}>안심 수거</a>
              <a href="#reviews" onClick={() => setIsMobileMenuOpen(false)}>고객 후기</a>
              <a href="#stats" onClick={() => setIsMobileMenuOpen(false)}>올클 성과</a>
            </nav>
            <a
              href="#eco"
              onClick={() => setIsMobileMenuOpen(false)}
              className="mt-2 py-4 rounded-xl bg-green-50 text-green-700 text-center font-bold flex items-center justify-center gap-2 border border-green-100"
            >
              올클의 환경 가치 <span>🌿</span>
            </a>
          </div>
        )}
      </header>

      {/* ================= 히어로 ================= */}
      <section id="top" className="relative min-h-[100svh] sm:min-h-[90svh] flex flex-col justify-end sm:justify-center overflow-hidden pb-6 sm:pb-24 pt-4 sm:pt-0">
        
        {/* 애니메이션 스타일 정의 */}
        <style>{`
          @keyframes blob {
            0% { transform: translate(0px, 0px) scale(1); }
            33% { transform: translate(30px, -50px) scale(1.1); }
            66% { transform: translate(-20px, 20px) scale(0.9); }
            100% { transform: translate(0px, 0px) scale(1); }
          }
          .animate-blob { animation: blob 10s infinite alternate; }
          .animation-delay-2000 { animation-delay: 2s; }
          .animation-delay-4000 { animation-delay: 4s; }
          
          /* 글래스모피즘 컨테이너 효과 (모바일 버튼용) */
          .glass-panel {
            background: rgba(255, 255, 255, 0.4);
            box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.05);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            border: 1px solid rgba(255, 255, 255, 0.6);
          }

          /* 카카오 전용 글래스모피즘 노란색 버튼 */
          .glass-btn-yellow {
            background: rgba(254, 229, 0, 0.75);
            box-shadow: 0 8px 32px 0 rgba(254, 229, 0, 0.3);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            border: 1px solid rgba(255, 255, 255, 0.5);
          }
          
          /* 파란색 메인 버튼 글래스모피즘 */
          .glass-btn-primary {
            background: rgba(37, 99, 235, 0.75);
            box-shadow: 0 8px 32px 0 rgba(37, 99, 235, 0.3);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            border: 1px solid rgba(255, 255, 255, 0.5);
          }
        `}</style>

        {/* === 데스크탑(웹) 배경 (기존) === */}
        <div
          className="hidden sm:block absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 90% 70% at 30% 20%, #dbeafe 0%, #F7F8FC 55%), radial-gradient(ellipse 70% 60% at 80% 90%, #e0f2fe 0%, transparent 60%)',
          }}
        />
        <div className="hidden sm:flex absolute inset-0 items-center justify-center pointer-events-none select-none overflow-hidden pb-24">
          <span className="text-[22vw] leading-none font-black text-[rgba(37,99,235,0.08)] whitespace-nowrap">
            ALLCLEAR
          </span>
        </div>

        {/* === 모바일 배경 (청량한 아이폰 UI 스타일) === */}
        <div className="sm:hidden absolute inset-0 bg-gradient-to-b from-sky-50/80 to-blue-50/40 overflow-hidden pointer-events-none">
          {/* 청량한 물방울/빛망울 느낌의 데코레이션 */}
          <div className="absolute top-[5%] right-[-10%] w-[280px] h-[280px] bg-sky-200/40 rounded-full blur-[40px] animate-blob"></div>
          <div className="absolute top-[30%] left-[-5%] w-[180px] h-[180px] bg-blue-200/40 rounded-full blur-[30px] animate-blob animation-delay-2000"></div>
          <div className="absolute bottom-[10%] right-[10%] w-[220px] h-[220px] bg-indigo-100/40 rounded-full blur-[40px] animate-blob animation-delay-4000"></div>
          <div className="absolute top-[15%] left-[20%] w-[60px] h-[60px] bg-white/60 rounded-full blur-[15px]"></div>
          <div className="absolute bottom-[30%] left-[15%] w-[100px] h-[100px] bg-white/50 rounded-full blur-[25px]"></div>
        </div>

        {/* === 데스크탑(웹) 전용 컨텐츠 === */}
        <div className="hidden sm:flex relative z-10 max-w-7xl mx-auto w-full px-5 md:px-8 pt-4 pb-10 flex-col">
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
            <p className="reveal reveal-delay-2 text-base sm:text-xl md:text-2xl text-gray-600 font-medium max-w-2xl leading-relaxed break-keep">
              문 앞에 헌옷을 담아두기만 하면 모든 것이 <br className="block sm:hidden" />
              <strong className="text-primary-600 font-black tracking-tight text-3xl sm:text-inherit block sm:inline mt-2 sm:mt-0">ALL CLEAR!</strong>
              <br />
              투명하고 안전한 비대면 수거부터 
              <br />
              기분 좋은 정산까지 완벽하게 해결해 드립니다.
            </p>

            <div className="reveal reveal-delay-3 flex flex-col sm:flex-row items-center gap-4 shrink-0">
              {/* 카카오 로그인 버튼 (공통 글래스모피즘) */}
              <a
                href={KAKAO_LOGIN_URL}
                className="glass-btn-yellow flex items-center justify-center gap-2 px-8 py-4 rounded-full text-yellow-950 text-base font-extrabold hover:brightness-105 active:scale-95 transition-all w-full sm:w-auto"
              >
                💬 카카오로 3초만에 시작
              </a>

              {/* 자세히 알아보기 버튼 (공통 글래스모피즘) */}
              <a
                href="#how"
                className="glass-panel flex items-center justify-center gap-2 px-8 py-4 rounded-full text-gray-700 text-base font-bold hover:brightness-105 active:scale-95 transition-all w-full sm:w-auto"
              >
                자세히 알아보기
              </a>
            </div>
          </div>
        </div>

        {/* === 모바일 전용 컨텐츠 (아이폰 글래스모피즘 스타일) === */}
        <div className="sm:hidden relative z-10 w-full flex flex-col h-full pt-16 pb-8 px-5">
          
          {/* 전체를 감싸는 유리 패널 */}
          <div className="flex flex-col h-full bg-white/30 backdrop-blur-2xl border border-white/60 shadow-[0_8px_32px_rgba(37,99,235,0.05)] rounded-[2.5rem] p-7">
            
            <div className="flex-1 flex flex-col justify-center mt-2">
              {/* 상단 태그라인 */}
              <div className="reveal flex items-center gap-2 mb-5">
                <span className="h-[2px] w-6 bg-primary-500 rounded-full"></span>
                <span className="text-primary-600 font-extrabold tracking-widest text-[11px] uppercase">Eco-friendly</span>
              </div>

              {/* 메인 타이포그래피 */}
              <h1 className="reveal reveal-delay-1 font-black leading-[1.1] tracking-tighter text-[13vw] uppercase text-gray-900 break-words mb-5">
                Old <br/>Clothes,<br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-sky-500">All Clear.</span>
              </h1>

              {/* 서브 타이포그래피 */}
              <h2 className="reveal reveal-delay-2 text-[15px] font-extrabold text-gray-800 leading-snug mb-3">
                지구를 구하는 의류 수거,<br/>
                비우는 기쁨과 채워지는 환경 가치
              </h2>
              
              <p className="reveal reveal-delay-3 text-[13px] text-gray-600 font-medium leading-relaxed">
                문 앞에 헌옷을 담아두기만 하면 끝납니다.<br/>
                투명하고 안전한 비대면 수거부터<br/>
                기분 좋은 정산까지 완벽하게.
              </p>
            </div>

            {/* 하단 버튼 영역 */}
            <div className="w-full flex flex-col items-center mt-auto reveal reveal-delay-3 pt-6">
              <a
                href={KAKAO_LOGIN_URL}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-[#FEE500]/80 backdrop-blur-md border border-[#FEE500]/40 text-[#391B1B] text-[15px] font-extrabold hover:bg-[#FEE500] active:scale-95 transition-all mb-3 shadow-[0_4px_16px_rgba(254,229,0,0.25)]"
              >
                카카오로 로그인
              </a>
              <a
                href="#how"
                className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-white/40 backdrop-blur-md border border-white/60 text-gray-700 text-[14px] font-bold hover:bg-white/60 active:scale-95 transition-all shadow-sm"
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
        className="relative min-h-[auto] sm:min-h-[100svh] flex items-center scroll-mt-16 py-16 sm:py-24 bg-cover bg-center bg-no-repeat overflow-hidden"
        style={{ backgroundImage: "url('/how-bg.jpg')" }}
      >
        <div className="absolute inset-0 bg-white/30"></div>
        <div className="relative z-10 max-w-7xl mx-auto w-full px-5 md:px-8 flex flex-row flex-wrap sm:grid sm:grid-cols-2 gap-4 sm:gap-14 items-center justify-between">
          
          <div className="reveal reveal-delay-2 shrink-0 order-1 sm:order-2 w-[130px] sm:w-auto">
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

          <div className="order-2 sm:order-1 flex-1 min-w-[55%] sm:pl-8 md:pl-16 lg:pl-32">
            <p className="reveal text-primary-600 font-black tracking-widest text-sm sm:text-xl mb-2 sm:mb-4 hidden sm:block">헌옷 수거 서비스</p>
            <h2 className="reveal reveal-delay-1 text-2xl sm:text-5xl font-black leading-tight tracking-tight text-gray-900 break-keep">
              신청부터 정산까지,<br />
              완벽하게 ALL CLEAR!
            </h2>
            <p className="reveal reveal-delay-2 mt-4 sm:mt-6 text-gray-600 font-medium leading-relaxed text-sm sm:text-lg break-keep hidden sm:block">
              무겁게 들고 나갈 필요 없이 문 앞에만 두세요.
              <br className="hidden sm:block" />
              올클이 알아서 수거하고, 기분 좋은 정산금으로 돌려드립니다.
            </p>

            <ol className="mt-8 sm:mt-10 space-y-4 sm:space-y-5">
              {[
                { icon: '📱', title: '카카오로 간편 신청', desc: '주소와 수거 희망일만 선택' },
                { icon: '📦', title: '문 앞에 담아두기', desc: '박스·가방·봉투 무엇이든 OK' },
                { icon: '💰', title: '수거 후 바로 정산', 대sc: '무게 측정 후 알림톡으로 정산' },
              ].map((step, i) => (
                <li key={i} className={`reveal reveal-delay-${i + 1} flex items-start gap-3 sm:gap-4`}>
                  <span className="shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-primary-50 border border-primary-100 flex items-center justify-center text-xl sm:text-2xl shadow-sm text-primary-600">
                    {step.icon}
                  </span>
                  <div>
                    <p className="font-extrabold text-sm sm:text-base text-gray-900">{step.title}</p>
                    <p className="text-xs sm:text-sm text-gray-500 font-medium mt-0.5 sm:mt-1 break-keep">{step.desc || step.대sc}</p>
                  </div>
                </li>
              ))}
            </ol>

            <a
              href={KAKAO_LOGIN_URL}
              className="reveal reveal-delay-3 glass-btn-primary flex justify-center sm:inline-flex mt-8 sm:mt-10 px-6 py-3 sm:px-8 sm:py-4 rounded-full text-white font-extrabold hover:brightness-110 active:scale-95 transition-all text-sm sm:text-base w-full sm:w-auto text-center"
            >
              수거신청 하러가기
            </a>
          </div>

        </div>
      </section>

      {/* ================= 안심 & 맞춤 수거 ================= */}
      <section 
        id="trust" 
        className="relative min-h-[auto] sm:min-h-[100svh] flex items-center scroll-mt-16 py-16 sm:py-24 bg-cover bg-center bg-no-repeat overflow-hidden"
        style={{ backgroundImage: "url('/trust-bg.jpg')" }}
      >
        <div className="absolute inset-0 bg-white/30"></div>
        <div className="relative z-10 max-w-7xl mx-auto w-full px-5 md:px-8 flex flex-row flex-wrap sm:grid sm:grid-cols-2 gap-4 sm:gap-14 items-center justify-between">
          <div className="reveal reveal-delay-2 shrink-0 order-1 w-[130px] sm:w-auto">
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

          <div className="order-2 flex-1 min-w-[55%] sm:pr-8 md:pr-16 lg:pr-32">
            <p className="reveal text-primary-600 font-black tracking-widest text-sm sm:text-xl mb-2 sm:mb-4 hidden sm:block">맞춤 & 안심 수거</p>
            <h2 className="reveal reveal-delay-1 text-2xl sm:text-5xl font-black leading-tight tracking-tight text-gray-900 break-keep">
              원하는 날짜에,<br />
              믿을 수 있게
            </h2>
            <p className="reveal reveal-delay-2 mt-4 sm:mt-6 text-gray-600 font-medium leading-relaxed text-sm sm:text-lg break-keep hidden sm:block">
              이삿날처럼 <strong>꼭 그날 수거가 필요한 경우</strong>, 앱에서 직접 수거일을 확정할 수 있어요.
              <br className="hidden sm:block" />
              또한 비대면 수거를 하더라도 기사님이 <strong>현장 증빙 사진</strong>을 남겨주어, 누락 없이 투명하고 신뢰감 있는 정산이 가능합니다.
            </p>

            <div className="reveal reveal-delay-2 mt-6 sm:mt-10 grid grid-cols-2 gap-2 sm:gap-4 max-w-md">
              <div className="rounded-xl sm:rounded-2xl bg-white border border-gray-200 shadow-sm p-4 sm:p-5">
                <p className="text-xl sm:text-2xl mb-1">📅</p>
                <p className="font-extrabold text-xs sm:text-sm text-gray-900">수거일 지정</p>
                <p className="text-[10px] sm:text-xs text-gray-500 font-medium mt-1">원하는 날짜로 확정</p>
              </div>
              <div className="rounded-xl sm:rounded-2xl bg-primary-50 border border-primary-200 shadow-sm p-4 sm:p-5">
                <p className="text-xl sm:text-2xl mb-1">📸</p>
                <p className="font-extrabold text-xs sm:text-sm text-primary-900">투명한 증빙</p>
                <p className="text-[10px] sm:text-xs text-gray-500 font-medium mt-1">현장 사진으로 확인</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= 고객 후기 (Marquee) ================= */}
      <section id="reviews" className="relative py-16 sm:py-24 bg-sky-50 overflow-hidden scroll-mt-16">
        <div className="max-w-7xl mx-auto px-5 md:px-8 mb-12 text-center">
          <p className="reveal text-primary-600 font-black tracking-widest text-base sm:text-xl mb-3">생생한 수거 후기</p>
          <h2 className="reveal reveal-delay-1 text-2xl sm:text-5xl font-black tracking-tight text-gray-900 break-keep">
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
      <section id="stats" className="relative min-h-[auto] sm:min-h-[100svh] flex items-center scroll-mt-16 py-16 sm:py-24 overflow-hidden bg-white">
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
            className="reveal reveal-delay-3 glass-btn-primary inline-block mt-14 px-10 py-4 rounded-full text-white font-extrabold hover:brightness-110 active:scale-95 transition-all"
          >
            지금 바로 수거 신청하기
          </a>
        </div>
      </section>

      {/* ================= 환경 가치 & 최종 CTA + 푸터 ================= */}
      <footer 
        id="eco"
        className="relative pt-16 sm:pt-32 pb-12 text-center border-t border-gray-200 bg-cover bg-center bg-no-repeat overflow-hidden"
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

          <div className="grid grid-cols-2 md:grid-cols-2 gap-4 sm:gap-8 lg:gap-12">
            {/* 데이터 카드 1 */}
            <div className="reveal reveal-delay-1 bg-white/70 backdrop-blur-md rounded-2xl sm:rounded-3xl p-4 sm:p-10 border border-gray-100 shadow-sm hover:-translate-y-1 transition-transform">
              <div className="text-3xl sm:text-5xl mb-3 sm:mb-6">💧</div>
              <h4 className="text-base sm:text-2xl font-black text-gray-900 mb-2 sm:mb-3">물 2,700L 절약</h4>
              <p className="text-xs sm:text-base text-gray-600 font-medium leading-relaxed mb-4 sm:mb-6 break-keep">
                티셔츠 생산엔 <strong>2,700리터</strong>의 물이 소비됩니다. <strong>약 2.5년 마실 양</strong>으로, 재활용 시 수자원을 보호합니다.
              </p>
            </div>

            {/* 데이터 카드 2 */}
            <div className="reveal reveal-delay-2 bg-white/70 backdrop-blur-md rounded-2xl sm:rounded-3xl p-4 sm:p-10 border border-gray-100 shadow-sm hover:-translate-y-1 transition-transform">
              <div className="text-3xl sm:text-5xl mb-3 sm:mb-6">🌲</div>
              <h4 className="text-base sm:text-2xl font-black text-gray-900 mb-2 sm:mb-3">탄소 배출 19.5kg 감축</h4>
              <p className="text-xs sm:text-base text-gray-600 font-medium leading-relaxed mb-4 sm:mb-6 break-keep">
                중고 의류 착용은 평균 <strong>19.5kg 온실가스 감축</strong> 효과를 주며, <strong>소나무 3그루 1년 흡수량</strong>과 같습니다.
              </p>
            </div>

            {/* 데이터 카드 3 */}
            <div className="reveal reveal-delay-1 bg-white/70 backdrop-blur-md rounded-2xl sm:rounded-3xl p-4 sm:p-10 border border-gray-100 shadow-sm hover:-translate-y-1 transition-transform">
              <div className="text-3xl sm:text-5xl mb-3 sm:mb-6">⏳</div>
              <h4 className="text-base sm:text-2xl font-black text-gray-900 mb-2 sm:mb-3">탄소 발자국 25% 감소</h4>
              <p className="text-xs sm:text-base text-gray-600 font-medium leading-relaxed mb-4 sm:mb-6 break-keep">
                옷의 수명을 <strong>단 1년만 연장</strong>해도 의류 산업의 <strong>탄소 발자국을 약 25%</strong> 줄일 수 있습니다.
              </p>
            </div>

            {/* 데이터 카드 4 */}
            <div className="reveal reveal-delay-2 bg-white/70 backdrop-blur-md rounded-2xl sm:rounded-3xl p-4 sm:p-10 border border-gray-100 shadow-sm hover:-translate-y-1 transition-transform">
              <div className="text-3xl sm:text-5xl mb-3 sm:mb-6">🔥</div>
              <h4 className="text-base sm:text-2xl font-black text-gray-900 mb-2 sm:mb-3">매년 폐의류 80만 톤</h4>
              <p className="text-xs sm:text-base text-gray-600 font-medium leading-relaxed mb-4 sm:mb-6 break-keep">
                매년 쏟아지는 <strong>80만 톤 이상의 옷</strong>이 매립/소각되는 것을 막고 막대한 환경 비용을 절감합니다.
              </p>
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
