const fs = require('fs');

let content = fs.readFileSync('src/pages/SuperAdminDashboard.tsx', 'utf8');

content = content.replace(
  `            </div>

            {/* 파트너별 성과 테이블 */}`,
  `            </div>

            {/* 항목별 수거 내역 (전국) */}
            {monitoring.overview.categoryStats && monitoring.overview.categoryStats.length > 0 && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 mb-4">📦 항목별 수거 내역 (전국 통합)</h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {monitoring.overview.categoryStats.map((cat: any, i: number) => (
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

            {/* 파트너별 성과 테이블 */}`
);

fs.writeFileSync('src/pages/SuperAdminDashboard.tsx', content, 'utf8');
console.log('Patch super admin dashboard applied successfully.');
