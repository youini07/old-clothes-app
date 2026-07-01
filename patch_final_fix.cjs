const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/AdminDashboard.tsx', 'utf8');

const statesToAdd = `
  const [statsDate, setStatsDate] = useState<string>(''); // YYYY-MM-DD
  const [dailyStatsMap, setDailyStatsMap] = useState<Record<string, any>>({});
  const [statsActiveDriver, setStatsActiveDriver] = useState<string>('all');

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

if (!code.includes('const [statsDate, setStatsDate]')) {
  code = code.replace(
    "const [activeRegionTab, setActiveRegionTab] = useState<string>('ALL');",
    "const [activeRegionTab, setActiveRegionTab] = useState<string>('ALL');\n" + statesToAdd
  );
}

const effectToAdd = `
    if (authToken && !statsDate) {
      const today = new Date();
      today.setHours(today.getHours() + 9);
      const todayStr = today.toISOString().split('T')[0];
      setStatsDate(todayStr);
      fetchDailyStats(todayStr);
    }
`;

if (!code.includes('if (authToken && !statsDate)')) {
  code = code.replace(
    "if (authToken) {\n      fetchData();",
    "if (authToken) {\n      fetchData();\n" + effectToAdd
  );
}

fs.writeFileSync('frontend/src/pages/AdminDashboard.tsx', code);
console.log('Fixed states in AdminDashboard');
