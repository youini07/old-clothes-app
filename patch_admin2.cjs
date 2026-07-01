const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/AdminDashboard.tsx', 'utf8');

// 1. Remove the old dailyStats map block
const blockStart = code.indexOf("{/* 기사 일일 정산 요약 뷰 (특정 기사 선택 시에만) */}");
if (blockStart !== -1) {
  let blockEnd = code.indexOf("{/* 수거 리스트 (그리드 레이아웃) */}");
  if (blockEnd === -1) blockEnd = code.indexOf("        <div className=\"space-y-4\">", blockStart);
  
  if (blockEnd !== -1) {
    code = code.substring(0, blockStart) + code.substring(blockEnd);
  }
}

// 2. Add weeklyStats state
code = code.replace(
  "const [statsDate, setStatsDate] = useState<string>('');",
  "const [weeklyStats, setWeeklyStats] = useState<any[]>([]);\n  const [statsActiveDriver, setStatsActiveDriver] = useState<string>('all');"
);

// 3. Add fetchWeeklyStats function
const fetchWeeklyFunc = `
  const fetchWeeklyStats = async () => {
    try {
      const today = new Date();
      today.setHours(today.getHours() + 9);
      const endStr = today.toISOString().split('T')[0];
      
      const start = new Date();
      start.setDate(start.getDate() - 6);
      start.setHours(start.getHours() + 9);
      const startStr = start.toISOString().split('T')[0];
      
      const headers = { Authorization: \`Bearer \${authToken}\` };
      const res = await axios.get(\`\${import.meta.env.VITE_API_URL}/admin/drivers/daily-stats?startDate=\${startStr}&endDate=\${endStr}\`, { headers });
      setWeeklyStats(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (activeView === 'stats') {
      fetchWeeklyStats();
    }
  }, [activeView]);
`;

code = code.replace(
  "const handleStatsDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {",
  fetchWeeklyFunc + "\n  const handleStatsDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {"
);

// 4. Update the stats view rendering
const statsViewStart = code.indexOf("{/* 정산/통계 뷰 */}");
if (statsViewStart !== -1) {
  const statsViewEnd = code.indexOf("{/* 환경 설정 뷰 */}");
  
  const newStatsView = `
        {/* 정산/통계 뷰 */}
        {activeView === 'stats' && stats && (
          <div className="space-y-6">
            
            {/* 기사별 탭 네비게이션 */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide border-b border-gray-200">
              <button
                onClick={() => setStatsActiveDriver('all')}
                className={\`shrink-0 px-5 py-3 rounded-t-xl text-sm font-bold transition-all \${statsActiveDriver === 'all' ? 'bg-white text-blue-700 border-t border-l border-r border-gray-200 shadow-[0_-2px_4px_rgba(0,0,0,0.02)]' : 'text-gray-500 hover:text-gray-700'}\`}
              >
                📊 전체 통계
              </button>
              {drivers.map(driver => (
                <button
                  key={\`stats-tab-\${driver.id}\`}
                  onClick={() => setStatsActiveDriver(driver.id)}
                  className={\`shrink-0 px-5 py-3 rounded-t-xl text-sm font-bold transition-all flex items-center gap-2 \${statsActiveDriver === driver.id ? 'bg-white text-blue-700 border-t border-l border-r border-gray-200 shadow-[0_-2px_4px_rgba(0,0,0,0.02)]' : 'text-gray-500 hover:text-gray-700'}\`}
                >
                  🚚 {driver.user?.name || driver.name}
                </button>
              ))}
            </div>

            {statsActiveDriver === 'all' ? (
              <div className="space-y-6">
                {/* 기존 요약 카드 */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500 font-medium">총 수거 건수</p>
                    <p className="text-3xl font-extrabold text-gray-900 mt-1">{stats.summary.totalRequests}</p>
                  </div>
                  <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500 font-medium">완료 건수</p>
                    <p className="text-3xl font-extrabold text-green-600 mt-1">{stats.summary.completedCount}</p>
                  </div>
                  <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500 font-medium">총 수거 무게</p>
                    <p className="text-3xl font-extrabold text-blue-600 mt-1">{stats.summary.totalWeight}<span className="text-lg">kg</span></p>
                  </div>
                  <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500 font-medium">완료율</p>
                    <p className="text-3xl font-extrabold text-purple-600 mt-1">{stats.summary.completionRate}<span className="text-lg">%</span></p>
                  </div>
                </div>

                {/* 현재 상태 현황 */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">📍 현재 진행 상황</h3>
                  <div className="flex gap-4">
                    <div className="flex-1 bg-yellow-50 rounded-xl p-4 text-center">
                      <p className="text-2xl font-extrabold text-yellow-600">{stats.summary.pendingCount}</p>
                      <p className="text-xs text-yellow-700 font-medium mt-1">대기 중</p>
                    </div>
                    <div className="flex-1 bg-blue-50 rounded-xl p-4 text-center">
                      <p className="text-2xl font-extrabold text-blue-600">{stats.summary.inProgressCount}</p>
                      <p className="text-xs text-blue-700 font-medium mt-1">진행 중</p>
                    </div>
                    <div className="flex-1 bg-green-50 rounded-xl p-4 text-center">
                      <p className="text-2xl font-extrabold text-green-600">{stats.summary.completedCount}</p>
                      <p className="text-xs text-green-700 font-medium mt-1">완료</p>
                    </div>
                  </div>
                </div>

                {/* 권역별 통계 */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">🗺️ 권역별 수거 현황</h3>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {stats.regionalStats.map((r: any, i: number) => (
                      <div key={i} className="border border-gray-200 rounded-xl p-4 flex justify-between items-center bg-gray-50">
                        <div>
                          <p className="font-bold text-gray-900">{r.regionName}</p>
                          <p className="text-xs text-gray-500 mt-1">완료 {r.completedCount}건</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-extrabold text-blue-600">{r.totalWeight}kg</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-5 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                  <h3 className="text-lg font-bold text-gray-900">최근 7일 정산 내역</h3>
                  <span className="text-sm font-medium text-gray-500">기사: {drivers.find(d => d.id === statsActiveDriver)?.user?.name || ''}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-sm border-b border-gray-200">
                        <th className="p-4 font-medium text-center">날짜</th>
                        <th className="p-4 font-medium text-center">완료 건수</th>
                        <th className="p-4 font-medium text-center">총 무게 (kg)</th>
                        <th className="p-4 font-medium text-right">총 정산액 (원)</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm font-medium">
                      {[...Array(7)].map((_, i) => {
                        const d = new Date();
                        d.setDate(d.getDate() - (6 - i));
                        d.setHours(d.getHours() + 9);
                        const dateStr = d.toISOString().split('T')[0];
                        const dayData = weeklyStats.find(ws => ws.date === dateStr && ws.driverId === statsActiveDriver);
                        
                        return (
                          <tr key={i} className="border-b border-gray-100 hover:bg-blue-50/50 transition-colors">
                            <td className="p-4 text-center text-gray-600">{dateStr}</td>
                            <td className="p-4 text-center text-gray-900 font-bold">{dayData ? dayData.count : 0}건</td>
                            <td className="p-4 text-center text-blue-600 font-bold">{dayData ? dayData.totalWeight : 0}kg</td>
                            <td className="p-4 text-right text-gray-900 font-extrabold">
                              {dayData ? (dayData.totalPrice || 0).toLocaleString() : 0}원
                            </td>
                          </tr>
                        );
                      }).reverse()}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

`;

  code = code.substring(0, statsViewStart) + newStatsView + code.substring(statsViewEnd);
}

fs.writeFileSync('frontend/src/pages/AdminDashboard.tsx', code);
