const fs = require('fs');
const p = 'frontend/src/pages/Landing.tsx';
let content = fs.readFileSync(p, 'utf8');

// Comment out STATS block
content = content.replace(
  /const STATS = \[\s*\{\s*label: '올클 월간 평균 수거 무게', end: 50000, suffix: 'kg\+' \},\s*\{\s*label: '월 평균 수거 완료', end: 800, suffix: '건\+' \},\s*\];/s,
  '/*\nconst STATS = [\n  { label: \'올클 월간 평균 수거 무게\', end: 50000, suffix: \'kg+\' },\n  { label: \'월 평균 수거 완료\', end: 800, suffix: \'건+\' },\n];\n*/'
);

// Comment out CountUp component
content = content.replace(
  'function CountUp({ end, duration = 2000, suffix = \'\' }: { end: number; duration?: number; suffix?: string }) {',
  '/* function CountUp({ end, duration = 2000, suffix = \'\' }: { end: number; duration?: number; suffix?: string }) {',
);

// Find end of CountUp and add block comment closing
const countUpEndRegex = /(return <span>\{Math\.floor\(count\)\}\{suffix\}<\/span>;\n\})/s;
content = content.replace(countUpEndRegex, '$1\n*/');

fs.writeFileSync(p, content, 'utf8');
