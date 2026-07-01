const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/DriverDashboard.tsx', 'utf8');

const processFn = `
  const processSmsTemplate = (template: string, req: any, timeStr: string, phoneStr: string) => {
    if (!template) return '';
    let msg = template;
    msg = msg.replace(/{{고객명}}/g, req.userName || '');
    msg = msg.replace(/{{방문시간}}/g, timeStr);
    msg = msg.replace(/{{담당자연락처}}/g, phoneStr);
    return msg;
  };

  const getSmsTemplate1`;

code = code.replace('const getSmsTemplate1', processFn);

fs.writeFileSync('frontend/src/pages/DriverDashboard.tsx', code);
console.log('processSmsTemplate injected');
