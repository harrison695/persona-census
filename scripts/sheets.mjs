/* Build labelled contact sheets for every ad that has no hand-written read yet, so they can
 * be looked at in batches. Emits data/sheet_index.tsv mapping each cell label -> brand_adId. */
import fs from 'node:fs'; import path from 'node:path';
import sharp from 'sharp';
import { ckey } from './ckey.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const H = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/harvest.json'), 'utf8'));
const R = JSON.parse(fs.readFileSync(path.join(ROOT, 'roster.json'), 'utf8'));
const ANN = JSON.parse(fs.readFileSync(path.join(ROOT, 'annotations/personas.json'), 'utf8'));
const OUT = path.join(ROOT, 'data/sheets');
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });

const names = Object.fromEntries(R.brands.map(b => [b.k, b.n]));
const todo = [];
for (const b of R.brands) {
  const h = H.brands[b.k]; if (!h?.picks?.length) continue;
  for (const a of h.picks) {
    const id = `${b.k}_${a.id}`;
    if (ANN.byAd[id] || ANN.byConcept[ckey(a)]) continue;      // already hand-read
    if (!fs.existsSync(path.join(ROOT, 'public/img', id + '.webp'))) continue;
    todo.push({ id, brand: b.k, name: names[b.k], ad: a });
  }
}
console.log(`${todo.length} ads need a read`);

const CELL = 430, PAD = 8, LABEL = 30, COLS = 5, PER = 10;
const idx = [];
let sheet = 0;
for (let i = 0; i < todo.length; i += PER) {
  sheet++;
  const grp = todo.slice(i, i + PER);
  const rows = Math.ceil(grp.length / COLS), cols = Math.min(COLS, grp.length);
  const W = cols * (CELL + PAD) + PAD, Hh = rows * (CELL + LABEL + PAD) + PAD;
  const layers = [];
  for (let j = 0; j < grp.length; j++) {
    const c = j % COLS, r = Math.floor(j / COLS);
    const x = PAD + c * (CELL + PAD), y = PAD + r * (CELL + LABEL + PAD);
    const label = `${sheet}.${j + 1}`;
    idx.push([label, grp[j].id, grp[j].name, grp[j].ad.days, grp[j].ad.kind,
              (grp[j].ad.title || '').replace(/[\t\n]/g, ' ').slice(0, 60),
              (grp[j].ad.link || '').slice(0, 90)].join('\t'));
    const buf = await sharp(path.join(ROOT, 'public/img', grp[j].id + '.webp'))
      .resize({ width: CELL, height: CELL, fit: 'inside' }).toBuffer();
    const m = await sharp(buf).metadata();
    layers.push({ input: buf, left: x + Math.floor((CELL - m.width) / 2), top: y + LABEL });
    const txt = `<svg width="${CELL}" height="${LABEL}"><text x="2" y="21" font-family="Helvetica,Arial" font-size="18" font-weight="bold" fill="#FFD60A">[${label}] ${grp[j].name.replace(/&/g,'&amp;').slice(0,26)} ${grp[j].ad.days}d ${grp[j].ad.kind[0]}</text></svg>`;
    layers.push({ input: Buffer.from(txt), left: x, top: y });
  }
  await sharp({ create: { width: W, height: Hh, channels: 3, background: { r: 18, g: 20, b: 26 } } })
    .composite(layers).jpeg({ quality: 78 }).toFile(path.join(OUT, `s${String(sheet).padStart(2, '0')}.jpg`));
}
fs.writeFileSync(path.join(ROOT, 'data/sheet_index.tsv'), idx.join('\n'));
console.log(`${sheet} sheets -> data/sheets/`);
