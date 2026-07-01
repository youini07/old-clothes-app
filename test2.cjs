const fs = require('fs');
const code = fs.readFileSync('frontend/src/pages/DriverDashboard.tsx', 'utf8');
const s = code.indexOf("activeMainTab === 'calendar'");
console.log(code.substring(s, s+800));
