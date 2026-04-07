const fs = require('fs');
const file = 'src/pages/admin/HomeConfig.tsx';
const content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');
const replaced = [...lines.slice(0, 505), 'REPLACE_ME_TOKEN', ...lines.slice(1401)];
fs.writeFileSync(file, replaced.join('\n'));
console.log('File sliced successfully!');
