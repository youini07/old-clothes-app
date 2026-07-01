const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/DriverDashboard.tsx', 'utf8');

// Find the start of the SMS modal
const modalStart = code.indexOf('<div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center sm:p-4">');
if (modalStart !== -1) {
  // Find the end of the 3rd template block
  const template3End = code.indexOf('</a>', code.indexOf('3. 수거 완료 안내', modalStart)) + 4;
  
  if (template3End !== -1) {
    const customTemplates = `
              {/* 추가 커스텀 메시지들 */}
              {smsTemplates?.template1 && (
                <a 
                  href={\`sms:\${selectedSmsReq.req.phone}?body=\${encodeURIComponent(processSmsTemplate(smsTemplates.template1, selectedSmsReq.req, '오후 12시~2시', driverPhone.replace(/^(\\d{3})(\\d{3,4})(\\d{4})$/, '$1-$2-$3')))}\`}
                  onClick={() => setSelectedSmsReq(null)}
                  className="block w-full text-left p-4 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors mt-4"
                >
                  <div className="font-bold text-gray-800 mb-1">🔹 커스텀 메시지 1</div>
                  <div className="text-xs text-gray-600 line-clamp-2">{smsTemplates.template1}</div>
                </a>
              )}
              {smsTemplates?.template2 && (
                <a 
                  href={\`sms:\${selectedSmsReq.req.phone}?body=\${encodeURIComponent(processSmsTemplate(smsTemplates.template2, selectedSmsReq.req, '오후 12시~2시', driverPhone.replace(/^(\\d{3})(\\d{3,4})(\\d{4})$/, '$1-$2-$3')))}\`}
                  onClick={() => setSelectedSmsReq(null)}
                  className="block w-full text-left p-4 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors mt-3"
                >
                  <div className="font-bold text-gray-800 mb-1">🔹 커스텀 메시지 2</div>
                  <div className="text-xs text-gray-600 line-clamp-2">{smsTemplates.template2}</div>
                </a>
              )}
              {smsTemplates?.template3 && (
                <a 
                  href={\`sms:\${selectedSmsReq.req.phone}?body=\${encodeURIComponent(processSmsTemplate(smsTemplates.template3, selectedSmsReq.req, '오후 12시~2시', driverPhone.replace(/^(\\d{3})(\\d{3,4})(\\d{4})$/, '$1-$2-$3')))}\`}
                  onClick={() => setSelectedSmsReq(null)}
                  className="block w-full text-left p-4 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors mt-3"
                >
                  <div className="font-bold text-gray-800 mb-1">🔹 커스텀 메시지 3</div>
                  <div className="text-xs text-gray-600 line-clamp-2">{smsTemplates.template3}</div>
                </a>
              )}
`;

    // Insert the customTemplates right after template3End
    code = code.substring(0, template3End) + '\n' + customTemplates + code.substring(template3End);
    
    fs.writeFileSync('frontend/src/pages/DriverDashboard.tsx', code);
    console.log('Successfully injected custom templates into modal.');
  } else {
    console.log('template3End not found');
  }
} else {
  console.log('modalStart not found');
}
