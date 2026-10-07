import os
import re

file_path = 'frontend/src/pages/ReceiptPage.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add state variables for SNS URLs
state_pattern = r"const \[reviewError, setReviewError\] = useState<string \| null>\(null\);"
new_state = """const [reviewError, setReviewError] = useState<string | null>(null);
  
  // SNS/카페 링크 상태
  const [cafeUrl1, setCafeUrl1] = useState('');
  const [cafeUrl2, setCafeUrl2] = useState('');
  const [snsUrl1, setSnsUrl1] = useState('');
  const [snsUrl2, setSnsUrl2] = useState('');
  const [snsUrl3, setSnsUrl3] = useState('');
  const [isSnsSubmitting, setIsSnsSubmitting] = useState(false);
  const [snsSubmitMessage, setSnsSubmitMessage] = useState('');"""
if "cafeUrl1" not in content:
    content = re.sub(state_pattern, new_state, content)

# 2. Update initial load to set these URLs if the review exists
effect_pattern = r"setHasSubmittedReview\(res\.data\.hasReview\);"
new_effect = """setHasSubmittedReview(res.data.hasReview);
        if (res.data.review) {
          setCafeUrl1(res.data.review.cafeUrl1 || '');
          setCafeUrl2(res.data.review.cafeUrl2 || '');
          setSnsUrl1(res.data.review.snsUrl1 || '');
          setSnsUrl2(res.data.review.snsUrl2 || '');
          setSnsUrl3(res.data.review.snsUrl3 || '');
        }"""
if "setCafeUrl1(res.data.review.cafeUrl1" not in content:
    content = re.sub(effect_pattern, new_effect, content)

# 3. Handle SNS Submit
handle_sns_submit = """
  const handleSnsSubmit = async () => {
    setIsSnsSubmitting(true);
    setSnsSubmitMessage('');
    try {
      await axios.patch(`${import.meta.env.VITE_API_URL}/board/reviews/by-request/${id}/sns-links`, {
        cafeUrl1, cafeUrl2, snsUrl1, snsUrl2, snsUrl3
      });
      setSnsSubmitMessage('링크가 성공적으로 등록/수정되었습니다! 사장님 확인 후 처리됩니다.');
    } catch (err) {
      console.error(err);
      setSnsSubmitMessage('링크 등록 중 오류가 발생했습니다.');
    } finally {
      setIsSnsSubmitting(false);
    }
  };
"""
if "handleSnsSubmit" not in content:
    content = content.replace("const handleSubmitReview = async () => {", handle_sns_submit + "\n  const handleSubmitReview = async () => {")

# 4. Change review options to dropdown
old_review_options_ui = """<div className="flex flex-col gap-2 mb-3">
                    {reviewOptions.map((option, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedReviewOption(option)}
                        className={`text-left px-4 py-3 rounded-xl text-sm transition-all duration-200 border-2 ${
                          selectedReviewOption === option
                            ? 'border-amber-400 bg-amber-50 text-amber-700 font-bold'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-amber-200'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>"""
new_review_options_ui = """<div className="mb-3">
                    <select
                      value={selectedReviewOption || ''}
                      onChange={(e) => setSelectedReviewOption(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-sm border-2 border-gray-200 bg-white text-gray-700 focus:border-amber-400 focus:outline-none transition-colors"
                    >
                      <option value="" disabled>한줄평을 선택해주세요</option>
                      {reviewOptions.map((option, idx) => (
                        <option key={idx} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>"""
content = content.replace(old_review_options_ui, new_review_options_ui)

# 5. Add SNS input form in the hasSubmittedReview section
old_submitted_ui = """<div className="py-12 flex flex-col items-center justify-center space-y-3">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-2">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="font-bold text-gray-800 text-lg">소중한 후기가 등록되었습니다!</h3>
              <p className="text-sm text-gray-500 text-center">작성해주신 리뷰는 올클 서비스 발전에 큰 도움이 됩니다.<br/>앞으로도 많은 이용 부탁드립니다.</p>
            </div>"""

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

content = content.replace(old_submitted_ui, new_submitted_ui)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Patched ReceiptPage.tsx successfully.")
