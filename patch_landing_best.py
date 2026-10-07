import os

file_path = 'frontend/src/pages/Landing.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

best_review_ui = """
        {/* 베스트 후기 하이라이트 */}
        <div className="max-w-4xl mx-auto px-5 md:px-8 mb-16 reveal reveal-delay-2">
          <div className="bg-white rounded-3xl p-6 md:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-blue-50 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-[100px] -z-0 transition-transform group-hover:scale-110"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-sm">👑 베스트 리뷰</span>
                <div className="flex text-amber-400 text-lg">
                  ★★★★★
                </div>
              </div>
              <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-4 leading-relaxed break-keep">
                "이사가면서 헌옷이 산더미처럼 나왔는데, 올클 덕분에 10분만에 해결했어요! 너무 친절하시고 정산도 바로 들어와서 진짜 최고입니다. 맘카페에도 추천글 올렸어요!"
              </h3>
              <div className="flex items-center justify-between mt-8 border-t border-gray-100 pt-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-lg">김</div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm md:text-base">김** 고객님</p>
                    <p className="text-xs md:text-sm text-gray-500">서울 강남구 · 정산금액 28,400원</p>
                  </div>
                </div>
                <div className="hidden md:block bg-blue-50 px-4 py-2 rounded-xl border border-blue-100 text-blue-700 text-sm font-bold">
                  헌옷 35kg | 신발 12켤레 수거
                </div>
              </div>
            </div>
          </div>
        </div>
"""

if "👑 베스트 리뷰" not in content:
    content = content.replace('<div className="relative mt-16 max-w-[100vw]">', best_review_ui + '\n        <div className="relative mt-4 max-w-[100vw]">')
    content = content.replace('mt-16', 'mt-4', 1) # Reduce margin since best review is above it

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Patched Landing.tsx successfully.")
