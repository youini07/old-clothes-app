const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/AdminDashboard.tsx', 'utf8');

// 1. Remove the old dailyStats map block from the Route view
const blockStart = code.indexOf("{/* 기사 일일 정산 요약 뷰 (특정 기사 선택 시에만) */}");
if (blockStart !== -1) {
  let blockEnd = code.indexOf("{/* 수거 리스트 (그리드 레이아웃) */}");
  if (blockEnd === -1) blockEnd = code.indexOf("        <div className=\"space-y-4\">", blockStart);
  
  if (blockEnd !== -1) {
    code = code.substring(0, blockStart) + code.substring(blockEnd);
  }
}

// 2. Add statsActiveDriver state
code = code.replace(
  "const [statsDate, setStatsDate] = useState<string>('');",
  "const [statsDate, setStatsDate] = useState<string>('');\n  const [statsActiveDriver, setStatsActiveDriver] = useState<string>('all');"
);

// 3. Update the stats view rendering
const statsViewStart = code.indexOf("{/* 정산/통계 뷰 */}");
if (statsViewStart !== -1) {
  const statsViewEnd = code.indexOf("{/* 환경 설정 뷰 */}");
  
  const newStatsView = `
        {/* 정산/통계 뷰 */}
        {activeView === 'stats' && stats && (
          <div className="space-y-6 pb-20">
            
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
                {/* 전체 요약 카드 */}
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
              </div>
            ) : (
              <div className="bg-blue-50/50 border border-blue-100 rounded-3xl p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                  <div>
                    <h3 className="font-bold text-blue-900 text-xl flex items-center gap-2 mb-1">
                      🚚 {drivers.find(d => d.id === statsActiveDriver)?.user?.name || ''} 기사님 정산 현황
                    </h3>
                    <p className="text-sm text-blue-700/70">특정 날짜의 수거 및 정산 금액을 확인합니다.</p>
                  </div>
                  <div className="flex items-center bg-white border border-blue-200 rounded-xl px-4 py-2 shadow-sm focus-within:ring-2 focus-within:ring-blue-400 focus-within:border-blue-400 transition-all">
                    <svg className="w-5 h-5 text-blue-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                    <input 
                      type="date" 
                      value={statsDate} 
                      onChange={handleStatsDateChange} 
                      className="text-sm font-bold text-gray-800 outline-none w-[130px]" 
                    />
                  </div>
                </div>

                {dailyStatsMap[statsActiveDriver] ? (
                  <div className="grid grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm flex flex-col items-center justify-center text-center">
                      <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                        <span className="text-2xl">📦</span>
                      </div>
                      <span className="text-gray-500 text-sm font-medium mb-1">수거 완료</span>
                      <span className="text-3xl font-extrabold text-gray-900">{dailyStatsMap[statsActiveDriver].count}건</span>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm flex flex-col items-center justify-center text-center">
                      <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-3">
                        <span className="text-2xl">⚖️</span>
                      </div>
                      <span className="text-gray-500 text-sm font-medium mb-1">총 무게</span>
                      <span className="text-3xl font-extrabold text-blue-600">{dailyStatsMap[statsActiveDriver].totalWeight}kg</span>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm flex flex-col items-center justify-center text-center">
                      <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mb-3">
                        <span className="text-2xl">💰</span>
                      </div>
                      <span className="text-gray-500 text-sm font-medium mb-1">총 정산액</span>
                      <span className="text-3xl font-extrabold text-green-600">{dailyStatsMap[statsActiveDriver].totalPrice.toLocaleString()}원</span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white p-12 rounded-2xl text-center text-gray-500 font-medium">
                    해당 날짜에 수거 완료 내역이 없습니다.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

`;

  code = code.substring(0, statsViewStart) + newStatsView + code.substring(statsViewEnd);
}

fs.writeFileSync('frontend/src/pages/AdminDashboard.tsx', code);
