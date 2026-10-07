import re
import os

file_path = r'c:\Users\youin\OneDrive\바탕 화면\헌옷수거어플\frontend\src\pages\Landing.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add axios import
if "import axios" not in content:
    content = content.replace("import React, { useEffect, useRef, useState } from 'react';", "import React, { useEffect, useRef, useState } from 'react';\nimport axios from 'axios';")

# 2. Add getYoutubeEmbedUrl helper outside component
helper_code = """
const getYoutubeEmbedUrl = (url: string) => {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\\?v=|watch\\?.+&v=))([^&?]+)/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : url;
};
"""
if "getYoutubeEmbedUrl" not in content:
    content = content.replace("export default function Landing() {", helper_code + "\nexport default function Landing() {")

# 3. Add state and fetch inside Landing()
hook_code = """  const [eventYoutubeUrl, setEventYoutubeUrl] = useState<string | null>(null);

  useEffect(() => {
    axios.get(`${import.meta.env.VITE_API_URL}/public/global-settings`)
      .then(res => {
        if (res.data?.eventYoutubeUrl) setEventYoutubeUrl(res.data.eventYoutubeUrl);
      })
      .catch(err => console.error('이벤트 설정 로드 실패:', err));
  }, []);
"""
if "setEventYoutubeUrl" not in content:
    content = content.replace("  const [scrolled, setScrolled] = useState(false);", hook_code + "\n  const [scrolled, setScrolled] = useState(false);")


# 4. Modify the Event section to include the video conditionally
event_section_old = """          <div className="reveal reveal-delay-2 max-w-lg mx-auto bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
            <div className="w-full aspect-[3/4] bg-sky-100 flex items-center justify-center relative overflow-hidden group">
               <img src="/event_poster.jpg" alt="리뷰 이벤트 배너" className="absolute inset-0 w-full h-full object-cover" />
            </div>
            <div className="p-8 text-left bg-gradient-to-br from-white to-sky-50">
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
          </div>"""

event_section_new = """          <div className={`reveal reveal-delay-2 mx-auto grid gap-8 ${eventYoutubeUrl ? 'max-w-6xl grid-cols-1 lg:grid-cols-2 items-start' : 'max-w-lg grid-cols-1'}`}>
            
            {/* 왼쪽: 기존 이벤트 포스터 (영상이 있을 땐 좌측, 없을 땐 중앙) */}
            <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 h-full flex flex-col">
              <div className="w-full aspect-[3/4] sm:aspect-auto sm:flex-1 bg-sky-100 relative overflow-hidden">
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

            {/* 오른쪽: 당첨자 발표 영상 (관리자가 등록했을 경우에만 노출) */}
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
            
          </div>"""

content = content.replace(event_section_old, event_section_new)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Landing page patched.")
