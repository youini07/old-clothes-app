const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/DriverDashboard.tsx', 'utf8');

// 1. Revert getSmsTemplate1, 2, 3 to NOT use custom template
code = code.replace(
  "if (smsTemplates?.template1) {\n      return processSmsTemplate(smsTemplates.template1, req, timeString, formattedPhone);\n    }\n    \n    const tomorrow",
  "const tomorrow"
);

code = code.replace(
  "const formattedPhone = driverPhone.replace(/^(\\d{3})(\\d{3,4})(\\d{4})$/, '$1-$2-$3');\n    if (smsTemplates?.template2) {\n      return processSmsTemplate(smsTemplates.template2, req, '', formattedPhone);\n    }\n    return \\`안녕하세요!",
  "return \\`안녕하세요!"
);

code = code.replace(
  "const formattedPhone = driverPhone.replace(/^(\\d{3})(\\d{3,4})(\\d{4})$/, '$1-$2-$3');\n    \n    if (smsTemplates?.template3) {\n      return processSmsTemplate(smsTemplates.template3, req, '', formattedPhone);\n    }\n    \n    if (items.length > 0)",
  "if (items.length > 0)"
);

// 2. Modify the SMS Modal to include custom templates
const origModalStart = code.indexOf('<div className="space-y-3">');
const origModalEnd = code.indexOf('</div>\n          </div>\n        </div>\n      )}\n\n      {/* Bottom Tab Bar');

if (origModalStart !== -1 && origModalEnd !== -1) {
  const newModalContent = `
            <div className="space-y-3">
              <a 
                href={\`sms:\${selectedSmsReq.req.phone}?body=\${encodeURIComponent(getSmsTemplate1(selectedSmsReq.req))}\`}
                onClick={() => setSelectedSmsReq(null)}
                className="block w-full text-left p-4 rounded-xl border border-blue-100 bg-blue-50 hover:bg-blue-100 transition-colors"
              >
                <div className="font-bold text-blue-800 mb-1">1. 내일 방문 안내 (수거일 확정)</div>
                <div className="text-xs text-blue-600 line-clamp-2">"안녕하세요, 올클헌옷입니다. 내일 방문 예정입니다. 시간이 어려우시면 비대면 수거도..."</div>
              </a>
              
              <a 
                href={\`sms:\${selectedSmsReq.req.phone}?body=\${encodeURIComponent(getSmsTemplate2())}\`}
                onClick={() => setSelectedSmsReq(null)}
                className="block w-full text-left p-4 rounded-xl border border-indigo-100 bg-indigo-50 hover:bg-indigo-100 transition-colors"
              >
                <div className="font-bold text-indigo-800 mb-1">2. 수거 출발 안내</div>
                <div className="text-xs text-indigo-600 line-clamp-2">"안녕하세요! 올클입니다. 지금 고객님 댁으로 수거하러 출발합니다..."</div>
              </a>
              
              <a 
                href={\`sms:\${selectedSmsReq.req.phone}?body=\${encodeURIComponent(getSmsTemplate3(selectedSmsReq.req))}\`}
                onClick={() => setSelectedSmsReq(null)}
                className="block w-full text-left p-4 rounded-xl border border-green-100 bg-green-50 hover:bg-green-100 transition-colors"
              >
                <div className="font-bold text-green-800 mb-1">3. 수거 완료 안내</div>
                <div className="text-xs text-green-600 line-clamp-2">"안녕하세요! 올클입니다. 고객님의 헌옷 수거가 완료되었습니다..."</div>
              </a>

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
                  className="block w-full text-left p-4 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="font-bold text-gray-800 mb-1">🔹 커스텀 메시지 2</div>
                  <div className="text-xs text-gray-600 line-clamp-2">{smsTemplates.template2}</div>
                </a>
              )}
              {smsTemplates?.template3 && (
                <a 
                  href={\`sms:\${selectedSmsReq.req.phone}?body=\${encodeURIComponent(processSmsTemplate(smsTemplates.template3, selectedSmsReq.req, '오후 12시~2시', driverPhone.replace(/^(\\d{3})(\\d{3,4})(\\d{4})$/, '$1-$2-$3')))}\`}
                  onClick={() => setSelectedSmsReq(null)}
                  className="block w-full text-left p-4 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="font-bold text-gray-800 mb-1">🔹 커스텀 메시지 3</div>
                  <div className="text-xs text-gray-600 line-clamp-2">{smsTemplates.template3}</div>
                </a>
              )}
`;
  code = code.substring(0, origModalStart) + newModalContent + code.substring(origModalEnd);
}

// 3. Update the labels in DriverProfileForm
code = code.replace("1. 내일 방문 안내 (수거일 확정)", "추가 커스텀 메시지 1");
code = code.replace("2. 수거 출발 안내", "추가 커스텀 메시지 2");
code = code.replace("3. 수거 완료 안내", "추가 커스텀 메시지 3");
code = code.replace("빈칸으로 두시면 기본 메시지로 자동 발송됩니다.", "빈칸으로 두시면 문자 전송 목록에 나타나지 않습니다.");

fs.writeFileSync('frontend/src/pages/DriverDashboard.tsx', code);
console.log('Driver dashboard SMS modified');
