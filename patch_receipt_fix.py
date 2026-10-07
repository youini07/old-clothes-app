import os
import re

file_path = 'frontend/src/pages/ReceiptPage.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

new_submitted_ui = """<div className="py-8 flex flex-col items-center justify-center space-y-3">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-2">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="font-bold text-gray-800 text-lg">소중한 후기가 등록되었습니다!</h3>
              <p className="text-sm text-gray-500 text-center">작성해주신 리뷰는 올클 서비스 발전에 큰 도움이 됩니다.</p>
            </div>
            
            <div className="border-t border-gray-100 pt-6 mt-2">
              <div className="mb-4">
                <h4 className="font-extrabold text-blue-600 text-lg flex items-center gap-2">
                  🎁 리뷰 이벤트 참여 링크 등록
                </h4>
                <p className="text-xs text-gray-500 mt-1 break-keep">
                  맘카페나 블로그, SNS에 작성하신 리뷰 링크를 등록해 주세요!<br/>
                  사장님이 확인 후 혜택을 지급해 드립니다. (수정 가능)
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1">지역 맘카페 링크 (최대 2개)</label>
                  <input type="text" placeholder="카페 링크 1 입력..." value={cafeUrl1} onChange={e => setCafeUrl1(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm mb-2 focus:border-blue-400 focus:outline-none" />
                  <input type="text" placeholder="카페 링크 2 입력 (선택)..." value={cafeUrl2} onChange={e => setCafeUrl2(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:border-blue-400 focus:outline-none" />
                </div>
                
                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1">SNS/블로그 링크 (최대 3개)</label>
                  <input type="text" placeholder="SNS/블로그 링크 1 입력..." value={snsUrl1} onChange={e => setSnsUrl1(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm mb-2 focus:border-blue-400 focus:outline-none" />
                  <input type="text" placeholder="SNS/블로그 링크 2 입력 (선택)..." value={snsUrl2} onChange={e => setSnsUrl2(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm mb-2 focus:border-blue-400 focus:outline-none" />
                  <input type="text" placeholder="SNS/블로그 링크 3 입력 (선택)..." value={snsUrl3} onChange={e => setSnsUrl3(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:border-blue-400 focus:outline-none" />
                </div>
              </div>

              {snsSubmitMessage && (
                <div className="mt-4 p-3 bg-blue-50 text-blue-700 text-xs font-medium rounded-lg text-center">
                  {snsSubmitMessage}
                </div>
              )}

              <button
                onClick={handleSnsSubmit}
                disabled={isSnsSubmitting}
                className="w-full mt-5 py-4 bg-gray-900 text-white font-bold rounded-xl shadow-md hover:bg-black transition-colors"
              >
                {isSnsSubmitting ? '등록 중...' : '이벤트 참여 링크 등록/수정하기'}
              </button>
            </div>"""

# Replace everything from <div className="py-12 flex flex-col to </div> before the : ( else block )
match = re.search(r'<div className="py-12 flex flex-col items-center justify-center space-y-3">.*?</div>\s*\)\s*:\s*\(', content, re.DOTALL)
if match:
    content = content.replace(match.group(0), new_submitted_ui + "\n          ) : (")
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Patched correctly!")
else:
    print("Pattern not found!")
