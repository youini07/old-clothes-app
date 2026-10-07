import os

file_path = r'c:\Users\youin\OneDrive\바탕 화면\헌옷수거어플\frontend\src\pages\Landing.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = "{/* ================= 리클 성과 (통계) ================= */}"
end_marker = "지금 바로 수거 신청하기\n          </a>\n        </div>\n      </section>"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker) + len(end_marker)

if start_idx != -1 and end_idx != -1:
    replacement = """{/* ================= 진행중인 이벤트 ================= */}
      <section id="event" className="relative min-h-[auto] sm:min-h-[100svh] flex items-center scroll-mt-16 py-16 sm:py-24 overflow-hidden bg-sky-50">
        <div className="relative z-10 max-w-5xl mx-auto w-full px-5 text-center">
          <span className="reveal inline-block py-1.5 px-4 rounded-full bg-red-100 text-red-600 text-sm font-extrabold mb-6 border border-red-200 shadow-sm animate-bounce">
            EVENT
          </span>
          <h2 className="reveal reveal-delay-1 text-4xl sm:text-6xl md:text-7xl font-black tracking-tight leading-tight text-gray-900 mb-10">
            진행중인 <span className="text-primary-600">이벤트</span>
          </h2>
          
          <div className="reveal reveal-delay-2 max-w-lg mx-auto bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
            <div className="w-full aspect-[3/4] bg-sky-100 flex items-center justify-center relative overflow-hidden group">
               <img src="https://i.ibb.co/L5T13Q7/final-review-poster-skyblue-flat.jpg" alt="리뷰 이벤트 배너" className="absolute inset-0 w-full h-full object-cover" />
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
          </div>
        </div>
      </section>"""
    
    new_content = content[:start_idx] + replacement + content[end_idx:]
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Patched successfully via markers.")
else:
    print("Markers not found.")
