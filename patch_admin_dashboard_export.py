import os

file_path = 'frontend/src/pages/AdminDashboard.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

target1 = "  const [noticeForm, setNoticeForm] = useState({ title: '', content: '' });"
replacement1 = target1 + """
  const [reviewExtractStartDate, setReviewExtractStartDate] = useState('');
  const [reviewExtractEndDate, setReviewExtractEndDate] = useState('');
  const handleExtractReviews = async () => {
    if (!reviewExtractStartDate || !reviewExtractEndDate) {
      alert('시작일과 종료일을 모두 선택해주세요.');
      return;
    }
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/board/reviews/${partnerId}/export?startDate=${reviewExtractStartDate}&endDate=${reviewExtractEndDate}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const list = res.data.list;
      if (!list || list.length === 0) {
        alert('해당 기간에 등록된 리뷰가 없습니다.');
        return;
      }
      const text = list.map((item: any) => {
        const suffix = item.maskedPhone ? item.maskedPhone.split('-').pop() : '없음';
        return `${item.authorName}(${suffix})`;
      }).join(', ');
      
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        alert(`총 ${list.length}명의 명단이 복사되었습니다!\\n\\n${text}`);
      } else {
        alert(`총 ${list.length}명의 명단:\\n\\n${text}`);
      }
    } catch(e) {
      alert('명단 추출에 실패했습니다.');
    }
  };
"""

target2 = """            {boardTab === 'reviews' && (
              <div>
                {boardLoading ? ("""

replacement2 = """            {boardTab === 'reviews' && (
              <div>
                <div className="mb-6 p-4 bg-blue-50 rounded-2xl border border-blue-100 flex flex-col sm:flex-row items-center gap-3 justify-between">
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <span className="text-sm font-bold text-blue-900 whitespace-nowrap">명단 추출</span>
                    <input type="date" value={reviewExtractStartDate} onChange={e => setReviewExtractStartDate(e.target.value)} className="px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1" />
                    <span className="text-gray-400">~</span>
                    <input type="date" value={reviewExtractEndDate} onChange={e => setReviewExtractEndDate(e.target.value)} className="px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1" />
                  </div>
                  <button onClick={handleExtractReviews} className="w-full sm:w-auto px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-sm shadow-sm transition-colors whitespace-nowrap">
                    추출 후 복사하기
                  </button>
                </div>
                {boardLoading ? ("""

if target1 in content and target2 in content:
    content = content.replace(target1, replacement1)
    content = content.replace(target2, replacement2)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Frontend patched successfully!")
else:
    print("Target not found or already patched.")
