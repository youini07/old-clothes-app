const fs = require('fs');

let content = fs.readFileSync('src/pages/DriverDashboard.tsx', 'utf8');

content = content.replace(
  `        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">`,
  `        </div>
      </div>

      {dailyStats?.categoryStats && dailyStats.categoryStats.length > 0 && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mt-4">
          <h3 className="text-lg font-bold text-gray-900 mb-4">📦 항목별 수거 내역</h3>
          <div className="grid grid-cols-2 gap-3">
            {dailyStats.categoryStats.map((cat: any, i: number) => (
              <div key={i} className="border border-gray-200 rounded-xl p-3 bg-gray-50 flex justify-between items-center">
                <div>
                  <p className="font-bold text-gray-900 text-sm">{cat.categoryLabel}</p>
                  <p className="text-xs text-gray-500">{cat.quantity}{cat.unitType === 'KG' ? 'kg' : '대'}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-extrabold text-blue-600">{cat.subtotal.toLocaleString()}원</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4 mt-4">`
);

fs.writeFileSync('src/pages/DriverDashboard.tsx', content, 'utf8');
console.log('Patch driver dashboard applied successfully.');
