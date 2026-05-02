import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const FBCDN_RE = /fbcdn\.net|facebook\.com\/.*\.(jpg|jpeg|png|gif|webp)/i;

function extractUrls(obj, prefix = '') {
  const results = [];
  if (!obj || typeof obj !== 'object') return results;
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => results.push(...extractUrls(item, `${prefix}[${i}]`)));
    return results;
  }
  for (const [key, val] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${key}` : key;
    if (typeof val === 'string' && FBCDN_RE.test(val)) {
      results.push({ field: p, url: val });
    } else if (val && typeof val === 'object') {
      results.push(...extractUrls(val, p));
    }
  }
  return results;
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB || 'appdb' });
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();

  const lines = [];
  let total = 0;
  let idx = 1;

  for (const col of collections) {
    const name = col.name;
    const docs = await db.collection(name).find({}).toArray();
    for (const doc of docs) {
      const hits = extractUrls(doc);
      if (hits.length === 0) continue;
      total += hits.length;
      const label = doc.name || doc.nameAr || doc.title || doc.titleAr || String(doc._id);
      lines.push(`\n=== [${name}] "${label}" (id: ${doc._id}) ===`);
      hits.forEach((h) => {
        lines.push(`  #${idx++} field: ${h.field}`);
        lines.push(`  URL: ${h.url}`);
        lines.push('');
      });
    }
  }

  lines.unshift(`Facebook CDN URLs found: ${total}\n`);
  const outPath = path.join(__dirname, 'facebook-urls-report.txt');
  fs.writeFileSync(outPath, lines.join('\n'), 'utf-8');
  console.log(`Wrote ${total} URLs to ${outPath}`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
