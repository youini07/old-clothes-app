const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/DriverDashboard.tsx', 'utf8');

// 1. 상태 추가
code = code.replace(
  "const [driverPhone, setDriverPhone] = useState<string>('');",
  "const [driverPhone, setDriverPhone] = useState<string>('');\n  const [smsTemplates, setSmsTemplates] = useState<any>(null);\n  const [dailyStats, setDailyStats] = useState<{count: number, totalWeight: number, totalPrice: number} | null>(null);"
);

// 2. fetchData에서 smsTemplates와 dailyStats 패치
code = code.replace(
  "setDriverPhone(res.data.phone || '');",
  "setDriverPhone(res.data.phone || '');\n      try {\n        const smsRes = await axios.get(`${import.meta.env.VITE_API_URL}/driver/sms-template`, { headers: { Authorization: `Bearer ${authToken}` } });\n        if (smsRes.data.smsTemplates) setSmsTemplates(smsRes.data.smsTemplates);\n      } catch(e) {}\n      try {\n        const statsRes = await axios.get(`${import.meta.env.VITE_API_URL}/driver/daily-stats`, { headers: { Authorization: `Bearer ${authToken}` } });\n        setDailyStats(statsRes.data);\n      } catch(e) {}"
);

// 3. DriverProfileForm 렌더링 부분 교체
code = code.replace(
  "{authToken ? <DriverProfileForm authToken={authToken} /> : <div className=\"text-center py-10\">로그인이 필요합니다.</div>}",
  "{authToken ? <DriverProfileForm authToken={authToken} dailyStats={dailyStats} smsTemplates={smsTemplates} setSmsTemplates={setSmsTemplates} /> : <div className=\"text-center py-10\">로그인이 필요합니다.</div>}"
);

// 4. getSmsTemplate 치환 로직 추가 (주의: smsTemplates 캡처를 위해 getSmsTemplate1, 2, 3를 수정)
const replaceSmsLogic = `
  const processSmsTemplate = (template: string, req: RequestItem | null, timeString: string, formattedPhone: string) => {
    let result = template;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    result = result.replace(/\\{\\{고객명\\}\\}/g, req?.userName || '고객');
    result = result.replace(/\\{\\{방문일\\}\\}/g, \`\${tomorrow.getMonth() + 1}/\${tomorrow.getDate()}\`);
    result = result.replace(/\\{\\{방문시간\\}\\}/g, timeString);
    result = result.replace(/\\{\\{기사연락처\\}\\}/g, formattedPhone);
    result = result.replace(/\\{\\{총금액\\}\\}/g, req?.totalPrice ? req.totalPrice.toLocaleString() + '원' : '0원');
    return result;
  };

  const getSmsTemplate1 = (req: RequestItem) => {
    let timeString = '오후 12시~2시';
    if (req.confirmedDate || req.desiredDate) {
      const targetDateStr = req.confirmedDate || req.desiredDate;
      const d = new Date(targetDateStr as string | Date);
      const h = d.getHours();
      if (h > 0) {
        const startH = h - 1;
        const endH = h + 1;
        const formatHour = (hour: number) => {
          if (hour === 12) return '오후 12';
          if (hour > 12) return \`오후 \${hour - 12}\`;
          return \`오전 \${hour}\`;
        };
        const startAMPM = startH >= 12 ? '오후' : '오전';
        const endAMPM = endH >= 12 ? '오후' : '오전';
        
        const startStr = formatHour(startH);
        let endStr = (endH > 12 ? endH - 12 : endH).toString();
        
        if (startAMPM !== endAMPM) {
          endStr = \`\${endAMPM} \${endStr}\`;
        }
        
        timeString = \`\${startStr}시~\${endStr}시\`;
      }
    }
    
    const formattedPhone = driverPhone.replace(/^(\\d{3})(\\d{3,4})(\\d{4})$/, '$1-$2-$3');
    
    if (smsTemplates?.template1) {
      return processSmsTemplate(smsTemplates.template1, req, timeString, formattedPhone);
    }
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const day = tomorrow.getDate();
    
    return \`안녕하세요, 올클헌옷입니다.\\n내일(\${day}일) \${timeString} 사이 방문 예정입니다.\\n\\n시간이 어려우시면 비대면 수거도 가능합니다.\\n문 앞에 내놓아 주시면 수거 후 확인 즉시 입금 도와드립니다.\\n\\n공동현관 비밀번호를 알려주시면 수거가 더욱 원활하게 진행됩니다.\\n\\n문의사항은 아래 담당자님께 연락 부탁드립니다.\\n담당자님 연락처: \${formattedPhone}\`;
  };

  const getSmsTemplate2 = (req: RequestItem | null = null) => {
    const formattedPhone = driverPhone.replace(/^(\\d{3})(\\d{3,4})(\\d{4})$/, '$1-$2-$3');
    if (smsTemplates?.template2) {
      return processSmsTemplate(smsTemplates.template2, req, '', formattedPhone);
    }
    return \`안녕하세요! 올클입니다.\\n\\n지금 고객님 댁으로 수거하러 출발합니다!\\n곧 도착할 예정이오니 잠시만 기다려주세요.\\n감사합니다.\`;
  };

  // 수거 완료 문자 템플릿 — 항목별 영수증 형태
  const getSmsTemplate3 = (req: RequestItem) => {
    const price = req.totalPrice || 0;
    const items = req.collectionItems || [];
    const formattedPhone = driverPhone.replace(/^(\\d{3})(\\d{3,4})(\\d{4})$/, '$1-$2-$3');
    
    if (smsTemplates?.template3) {
      return processSmsTemplate(smsTemplates.template3, req, '', formattedPhone);
    }
    
    if (items.length > 0) {
      // 항목별 정산 내역이 있는 경우 영수증 형태
      const itemLines = items.map((item: any) => {
        const unitLabel = item.unitType === 'KG' ? 'kg' : '대';
        return \`· \${item.categoryLabel}: \${item.quantity}\${unitLabel} × \${item.unitPrice.toLocaleString()}원 = \${item.subtotal.toLocaleString()}원\`;
      }).join('\\n');
      return \`안녕하세요! 올클입니다.\\n\\n고객님의 수거가 완료되었습니다!\\n\\n[정산서]\\n\${itemLines}\\n────────\\n합계: \${price.toLocaleString()}원\\n\\n저희 올클을 이용해 주셔서 진심으로 감사드립니다.\`;
    }
    
    return \`안녕하세요! 올클입니다.\\n\\n고객님의 수거가 완료되었습니다!\\n확인 후 입금 진행해 드릴 예정입니다.\\n저희 올클을 이용해 주셔서 진심으로 감사드립니다.\`;
  };
`;

const origSmsStart = code.indexOf('const getSmsTemplate1 = (req: RequestItem) => {');
const origSmsEnd = code.indexOf('const getCategoryIcon', origSmsStart);
if(origSmsStart !== -1 && origSmsEnd !== -1) {
  code = code.substring(0, origSmsStart) + replaceSmsLogic + '\n  ' + code.substring(origSmsEnd);
}

fs.writeFileSync('frontend/src/pages/DriverDashboard.tsx', code);
