const fs = require('fs');

let content = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

// Insert after line 1709 (after <div className="grid sm:grid-cols-3 gap-4"> ... </div>)
// Wait, I will use replace.
content = content.replace(
  `                {/* 권역별 통계 */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">`,
  `                {/* 항목별 수거 내역 */}
                {stats.summary.categoryStats && stats.summary.categoryStats.length > 0 && (
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">📦 항목별 수거 내역</h3>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {stats.summary.categoryStats.map((cat: any, i: number) => (
                        <div key={i} className="border border-gray-200 rounded-xl p-4 flex justify-between items-center bg-gray-50">
                          <div>
                            <p className="font-bold text-gray-900">{cat.categoryLabel}</p>
                            <p className="text-xs text-gray-500 mt-1">{cat.quantity}{cat.unitType === 'KG' ? 'kg' : '대'}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-extrabold text-blue-600">{cat.subtotal.toLocaleString()}원</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* 권역별 통계 */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">`
);

content = content.replace(
  `                    <div className="bg-white p-6 rounded-2xl shadow-sm flex flex-col items-center justify-center text-center">
                      <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mb-3 border border-green-100">
                        <span className="text-2xl">💰</span>
                      </div>
                      <span className="text-gray-500 text-sm font-bold mb-1">총 정산액</span>
                      <span className="text-3xl font-extrabold text-green-600">{dailyStatsMap[statsActiveDriver].totalPrice.toLocaleString()}원</span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white p-12 rounded-2xl text-center text-gray-500 font-medium shadow-sm border border-gray-100 flex flex-col items-center">`,
  `                    <div className="bg-white p-6 rounded-2xl shadow-sm flex flex-col items-center justify-center text-center">
                      <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mb-3 border border-green-100">
                        <span className="text-2xl">💰</span>
                      </div>
                      <span className="text-gray-500 text-sm font-bold mb-1">총 정산액</span>
                      <span className="text-3xl font-extrabold text-green-600">{dailyStatsMap[statsActiveDriver].totalPrice.toLocaleString()}원</span>
                    </div>
                  </div>
                  
                  {dailyStatsMap[statsActiveDriver].categoryStats && dailyStatsMap[statsActiveDriver].categoryStats.length > 0 && (
                    <div className="mt-6 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                      <h3 className="text-lg font-bold text-gray-900 mb-4">📦 항목별 수거 내역</h3>
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {dailyStatsMap[statsActiveDriver].categoryStats.map((cat: any, i: number) => (
                          <div key={i} className="border border-gray-200 rounded-xl p-4 flex justify-between items-center bg-gray-50">
                            <div>
                              <p className="font-bold text-gray-900">{cat.categoryLabel}</p>
                              <p className="text-xs text-gray-500 mt-1">{cat.quantity}{cat.unitType === 'KG' ? 'kg' : '대'}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-extrabold text-blue-600">{cat.subtotal.toLocaleString()}원</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                ) : (
                  <div className="bg-white p-12 rounded-2xl text-center text-gray-500 font-medium shadow-sm border border-gray-100 flex flex-col items-center">`
);

fs.writeFileSync('src/pages/AdminDashboard.tsx', content, 'utf8');
console.log('Patch admin dashboard applied successfully.');
