const fs = require('fs');
const code = fs.readFileSync('frontend/src/pages/DriverDashboard.tsx', 'utf8');
const s = code.indexOf("activeMainTab === 'profile' (");
console.log(code.substring(Math.max(0, s-50), s+1500));
