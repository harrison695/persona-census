/* Download + resize creative stills referenced by data/harvest.json into public/img.
 * fbcdn URLs are signed and every query param is load-bearing from a non-browser client —
 * they cannot be minimised (verified: stripped URLs 403). Files are named <brand>_<adId>.webp
 * so the set is stable across refreshes and git only churns on genuinely new creative. */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'public/img');
fs.mkdirSync(OUT, { recursive: true });
const h = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/harvest.json'), 'utf8'));

const jobs = [];
for (const b of Object.values(h.brands)) for (const a of (b.picks || [])) jobs.push({ name: `${b.key}_${a.id}`, url: a.url });

const keep = new Set(jobs.map(j => j.name + '.webp'));
let skipped = 0, fetched = 0, failed = 0;

async function one(j) {
  const dest = path.join(OUT, j.name + '.webp');
  if (fs.existsSync(dest) && fs.statSync(dest).size > 900) { skipped++; return; }
  for (let a = 0; a < 3; a++) {
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 30000);
      const r = await fetch(j.url, { signal: ctl.signal, headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'image/webp,image/*,*/*' } });
      clearTimeout(t);
      if (!r.ok) throw new Error('http ' + r.status);
      const buf = Buffer.from(await r.arrayBuffer());
      await sharp(buf).resize({ width: 620, withoutEnlargement: true }).webp({ quality: 74 }).toFile(dest);
      fetched++; return;
    } catch (e) { if (a === 2) { failed++; console.log('  fail', j.name, String(e).slice(0, 50)); } await new Promise(r => setTimeout(r, 700 * (a + 1))); }
  }
}

const LIM = 8;
let i = 0;
await Promise.all(Array.from({ length: LIM }, async () => { while (i < jobs.length) { await one(jobs[i++]); } }));

// prune stills whose ad is no longer in the top picks, so the repo does not grow forever
let pruned = 0;
for (const f of fs.readdirSync(OUT)) if (f.endsWith('.webp') && !keep.has(f)) { fs.unlinkSync(path.join(OUT, f)); pruned++; }

// record natural dimensions so each card's stage can match its creative exactly
const dims = {};
for (const f of fs.readdirSync(OUT)) {
  if (!f.endsWith('.webp')) continue;
  try { const m = await sharp(path.join(OUT, f)).metadata(); dims[f.replace('.webp', '')] = [m.width, m.height]; } catch {}
}
fs.writeFileSync(path.join(ROOT, 'data/imgdims.json'), JSON.stringify(dims));

const bytes = fs.readdirSync(OUT).reduce((s, f) => s + fs.statSync(path.join(OUT, f)).size, 0);
console.log(`images: ${fetched} fetched, ${skipped} cached, ${failed} failed, ${pruned} pruned — ${(bytes / 1048576).toFixed(1)} MB total`);
if (failed > jobs.length * 0.25) { console.error('FATAL: >25% of images failed'); process.exit(3); }
