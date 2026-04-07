import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd(), 'src');
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.css', '.html', '.json']);

const mojibakePattern = /[ØÙÃÂï¿]/;
const replacementCharPattern = /\uFFFD/;
const controlCharPattern = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

const findings = [];

const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    const ext = path.extname(entry.name);
    if (!EXTENSIONS.has(ext)) continue;

    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split(/\r?\n/);

    lines.forEach((line, idx) => {
      if (mojibakePattern.test(line) || replacementCharPattern.test(line) || controlCharPattern.test(line)) {
        findings.push({
          file: path.relative(process.cwd(), fullPath),
          line: idx + 1,
          text: line.trim().slice(0, 180),
        });
      }
    });
  }
};

if (!fs.existsSync(ROOT)) {
  console.error('Cannot find src/ directory to scan.');
  process.exit(1);
}

walk(ROOT);

if (findings.length === 0) {
  console.log('Encoding check passed: no corrupted text patterns found.');
  process.exit(0);
}

console.error(`Encoding check failed: found ${findings.length} suspicious line(s).`);
for (const finding of findings) {
  console.error(`${finding.file}:${finding.line} -> ${finding.text}`);
}
process.exit(1);
