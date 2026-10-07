const fs = require('fs');
const p = 'frontend/src/pages/Landing.tsx';
let content = fs.readFileSync(p, 'utf8');

content = content.replace(
  /\/\/ @ts-ignore\nfunction CountUp\(/g,
  'export function CountUp('
);

content = content.replace(
  /\nfunction CountUp\(/g,
  '\nexport function CountUp('
);

fs.writeFileSync(p, content, 'utf8');
