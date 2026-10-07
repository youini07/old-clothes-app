const fs = require('fs');
try {
  const p = 'frontend/src/pages/Landing.tsx';
  let content = fs.readFileSync(p, 'utf8');

  const getYoutubeHelper = `
const getYoutubeEmbedUrl = (url: string) => {
  const match = url.match(/(?:youtu\\.be\\/|youtube\\.com\\/(?:embed\\/|v\\/|watch\\?v=|watch\\?.+&v=))([^&?]+)/);
  return match ? \`https://www.youtube.com/embed/\${match[1]}\` : url;
};
`;

  const hookCode = `
  const [eventYoutubeUrl, setEventYoutubeUrl] = useState<string | null>(null);

  useEffect(() => {
    axios.get(\`\${import.meta.env.VITE_API_URL}/public/global-settings\`)
      .then(res => {
        if (res.data?.eventYoutubeUrl) setEventYoutubeUrl(res.data.eventYoutubeUrl);
      })
      .catch(err => console.error('이벤트 설정 로드 실패:', err));
  }, []);
`;

  const eventSection = `{/* ================= 진행중인 이벤트 ================= */}
      <section id="event" className="relative min-h-[auto] sm:min-h-[100svh] flex items-center scroll-mt-16 py-16 sm:py-24 overflow-hidden bg-sky-50">
        <div className="relative z-10 max-w-5xl mx-auto w-full px-5 text-center">
          <span className="reveal inline-block py-1.5 px-4 rounded-full bg-red-100 text-red-600 text-sm font-extrabold mb-6 border border-red-200 shadow-sm animate-bounce">
            EVENT
          </span>
          <h2 className="reveal reveal-delay-1 text-4xl sm:text-6xl md:text-7xl font-black tracking-tight leading-tight text-gray-900 mb-10">
            진행중인 <span className="text-primary-600">이벤트</span>
          </h2>
          
          <div className={\`reveal reveal-delay-2 mx-auto grid gap-8 \${eventYoutubeUrl ? 'max-w-6xl grid-cols-1 lg:grid-cols-2 items-start' : 'max-w-lg grid-cols-1'}\`}>
            
            {/* 왼쪽: 기존 이벤트 포스터 */}
            <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 h-full flex flex-col">
              <div className="w-full aspect-[3/4] sm:aspect-auto sm:flex-1 bg-sky-100 relative overflow-hidden group">
                 <img src="/event_poster.jpg" alt="리뷰 이벤트 배너" className="absolute inset-0 w-full h-full object-cover" />
              </div>
              <div className="p-8 text-left bg-gradient-to-br from-white to-sky-50 mt-auto">
                <h3 className="text-2xl font-black text-gray-900 mb-3">🍗 헌옷수거 리뷰 달고 치킨 받자!</h3>
                <p className="text-gray-600 font-medium leading-relaxed mb-6 text-sm">
                  수거 완료 후 모바일 영수증에 첨부된 링크를 통해 <strong>홈페이지 리뷰를 작성</strong>해 주시면, 매월 추첨을 통해 5분께 치킨 기프티콘을 쏩니다! (리뷰 작성 시 자동 응모)
                </p>
                <a
                  href={KAKAO_LOGIN_URL}
                  className="w-full glass-btn-primary block text-center py-4 rounded-xl text-white font-extrabold hover:brightness-110 active:scale-95 transition-all shadow-md"
                >
                  로그인하고 헌옷수거 리뷰 작성하기
                </a>
              </div>
            </div>

            {/* 오른쪽: 당첨자 발표 영상 */}
            {eventYoutubeUrl && (
              <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100 h-full flex flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-500 to-red-400"></div>
                <div className="mb-8 text-center w-full">
                  <span className="inline-block py-1.5 px-4 rounded-full bg-red-100 text-red-600 text-sm font-extrabold mb-4 shadow-sm animate-pulse">
                    🚨 당첨자 발표
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-black text-gray-900">이달의 치킨 당첨자는?</h3>
                  <p className="text-gray-500 mt-2 font-medium">영상을 통해 지금 바로 확인하세요!</p>
                </div>
                <div className="w-full aspect-video rounded-2xl overflow-hidden shadow-inner border border-gray-100 bg-gray-50 flex items-center justify-center">
                  <iframe 
                    width="100%" 
                    height="100%" 
                    src={getYoutubeEmbedUrl(eventYoutubeUrl)} 
                    title="YouTube video player" 
                    frameBorder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                    allowFullScreen
                    className="w-full h-full"
                  ></iframe>
                </div>
              </div>
            )}
            
          </div>
        </div>
      </section>`;

  if (!content.includes('import axios')) {
    content = content.replace("import React, { useEffect, useRef, useState } from 'react';", "import React, { useEffect, useRef, useState } from 'react';\nimport axios from 'axios';");
  }

  if (!content.includes('getYoutubeEmbedUrl')) {
    content = content.replace('export default function Landing() {', getYoutubeHelper + '\nexport default function Landing() {');
  }

  if (!content.includes('setEventYoutubeUrl')) {
    content = content.replace('const [scrolled, setScrolled] = useState(false);', hookCode + '\n  const [scrolled, setScrolled] = useState(false);');
  }

  const statsIdx = content.indexOf('id="stats"');
  if (statsIdx !== -1) {
    const commentIdx = content.lastIndexOf('{/*', statsIdx);
    const endSectionIdx = content.indexOf('</section>', statsIdx) + '</section>'.length;
    
    content = content.substring(0, commentIdx) + eventSection + content.substring(endSectionIdx);
    fs.writeFileSync(p, content, 'utf8');
    fs.writeFileSync('debug.txt', 'SUCCESS! ' + statsIdx + ' ' + commentIdx + ' ' + endSectionIdx);
  } else {
    fs.writeFileSync('debug.txt', 'STATS ID NOT FOUND');
  }
} catch (e) {
  fs.writeFileSync('debug.txt', e.toString());
}
