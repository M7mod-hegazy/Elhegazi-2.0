const fs = require('fs');

const filePath = 'src/pages/admin/Settings.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Only replace ???? sequences that are clearly corrupted text (3+ question marks in a row, not ?? operator)
// Using word boundaries to avoid breaking ??
const corruptedPatterns = [
  { pattern: /'\?\?\? [^']*'/g, replacement: (match) => "'" + match.slice(4, -1).replace(/\?+/g, '؟') + "'" },
  { pattern: /"\?\?\? [^"]*"/g, replacement: (match) => '"' + match.slice(4, -1).replace(/\?+/g, '؟') + '"' },
];

// Better approach: replace specific known corrupted strings manually
const manualReplacements = [
  // These are the actual corrupted strings found in the file
  ["'???? ????? ????????? ??????'", "'فشل تحميل إعدادات لوحة المالك'"],
  ["'???? ???? ???? ????'", "'الرجاء إدخال رابط صحيح'"],
  ["'???? ??? ??????...'", "'جاري التحقق...'"],
  ["'error' in validate ? validate.error : '??? ??? ??????'", "'error' in validate ? validate.error : 'فشل التحقق من الرابط'"],
  ["'???? ??????? ??????...'", "'جاري رفع الشعار...'"],
  ["'error' in uploaded ? uploaded.error : '??? ??? ?????? ?? ?????'", "'error' in uploaded ? uploaded.error : 'فشل رفع الشعار'"],
  ["'?? ??????? ?????? ?? ??????'", "'تم حفظ الشعار بنجاح'"],
  ["'error' in validate ? validate.error : '??? ??? ??????'", "'error' in validate ? validate.error : 'فشل التحقق من الرابط'"],
  ["'error' in uploaded ? uploaded.error : '??? ??? ?????? ?? ?????'", "'error' in uploaded ? uploaded.error : 'فشل رفع الشعار'"],
];

manualReplacements.forEach(([from, to]) => {
  content = content.split(from).join(to);
});

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed!');
console.log('Checking for remaining ??? in strings...');

// Check what's actually left
const lines = content.split('\n');
let issues = 0;
lines.forEach((line, i) => {
  if (line.includes("'????") || line.includes('"????')) {
    console.log(`Line ${i+1}: ${line.trim().substring(0,80)}`);
    issues++;
  }
});
console.log(`Found ${issues} lines with ???? in strings`);