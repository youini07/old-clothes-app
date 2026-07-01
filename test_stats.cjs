const fs = require('fs');
const code = fs.readFileSync('frontend/src/pages/AdminDashboard.tsx', 'utf8');
const s = code.indexOf("activeView === 'stats'");
console.log(code.substring(s, s+1500));
