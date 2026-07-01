const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/AdminDashboard.tsx', 'utf8');

// 1. 상태 및 함수 추가
const statesToAdd = `
  const [statsDate, setStatsDate] = useState<string>(''); // YYYY-MM-DD
  const [dailyStatsMap, setDailyStatsMap] = useState<Record<string, any>>({});

  const fetchDailyStats = async (date: string) => {
    try {
      const headers = { Authorization: \`Bearer \${authToken}\` };
      const res = await axios.get(\`\${import.meta.env.VITE_API_URL}/admin/drivers/daily-stats?date=\${date}\`, { headers });
      const statsObj: Record<string, any> = {};
      res.data.forEach((s: any) => { statsObj[s.driverId] = s; });
      setDailyStatsMap(statsObj);
    } catch (e) { console.error('통계 조회 오류', e); }
  };

  const handleStatsDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    setStatsDate(newDate);
    fetchDailyStats(newDate);
  };
`;

code = code.replace(
  "const [socketParams, setSocketParams] = useState<any>(null);",
  "const [socketParams, setSocketParams] = useState<any>(null);\n" + statesToAdd
);

// 2. 초기 로드 시 오늘 날짜로 패치
code = code.replace(
  "if (socketParams) {",
  "if (authToken && !statsDate) {\n      const today = new Date();\n      today.setHours(today.getHours() + 9);\n      const todayStr = today.toISOString().split('T')[0];\n      setStatsDate(todayStr);\n      fetchDailyStats(todayStr);\n    }\n    if (socketParams) {"
);

// 3. UI 삽입 부분 찾기
// 기사 탭 리스트 바로 밑에 (또는 리스트 위에) 삽입
const uiToInsert = `
        {/* 기사 일일 정산 요약 뷰 (특정 기사 선택 시에만) */}
        {activeDriverId !== 'all' && activeDriverId !== 'unassigned' && dailyStatsMap[activeDriverId] && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center shadow-sm gap-4">
            <div className="flex items-center gap-4">
              <h3 className="font-bold text-blue-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                당일 수거 정산 조회
              </h3>
              <input type="date" value={statsDate} onChange={handleStatsDateChange} className="border border-blue-200 rounded-lg px-3 py-1.5 text-sm text-blue-900 bg-white shadow-inner outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all" />
            </div>
            <div className="flex gap-6 text-sm font-bold text-blue-800 bg-white py-2 px-4 rounded-lg shadow-sm border border-blue-100 w-full sm:w-auto">
              <div className="flex flex-col"><span className="text-blue-500 text-[11px]">수거완료</span><span className="text-lg">{dailyStatsMap[activeDriverId].count}건</span></div>
              <div className="flex flex-col"><span className="text-blue-500 text-[11px]">총 무게</span><span className="text-lg">{dailyStatsMap[activeDriverId].totalWeight}kg</span></div>
              <div className="flex flex-col"><span className="text-blue-500 text-[11px]">총 금액</span><span className="text-lg">{dailyStatsMap[activeDriverId].totalPrice.toLocaleString()}원</span></div>
            </div>
          </div>
        )}
`;

const tabsEnd = code.indexOf('</div>\n\n        {/* 리스트 헤더 / 옵션 */}');
if (tabsEnd !== -1) {
  code = code.substring(0, tabsEnd + 6) + '\n' + uiToInsert + '\n' + code.substring(tabsEnd + 6);
}

fs.writeFileSync('frontend/src/pages/AdminDashboard.tsx', code);
