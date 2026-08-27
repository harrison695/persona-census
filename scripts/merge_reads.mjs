/* Fold hand-written reads (label -> persona/psychographic) into annotations/personas.json,
 * keyed by BOTH ad id and concept so they survive future harvests. */
import fs from 'node:fs'; import path from 'node:path';
import { ckey } from './ckey.mjs';
const ROOT = path.resolve(import.meta.dirname, '..');
const H = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/harvest.json'), 'utf8'));
const ANN = JSON.parse(fs.readFileSync(path.join(ROOT, 'annotations/personas.json'), 'utf8'));

const idx = {};
for (const line of fs.readFileSync(path.join(ROOT, 'data/sheet_index.tsv'), 'utf8').split('\n')) {
  const p = line.split('\t'); if (p.length >= 2) idx[p[0]] = p[1];
}
const adById = {};
for (const b of Object.values(H.brands)) for (const a of (b.picks || [])) adById[`${b.key}_${a.id}`] = a;

let merged = 0, missing = 0;
for (const line of fs.readFileSync(path.join(ROOT, 'annotations/reads_all.tsv'), 'utf8').split('\n')) {
  const [label, persona, psycho] = line.split('\t');
  if (!label || !persona || !psycho) continue;
  const id = idx[label];
  const ad = adById[id];
  if (!ad) { missing++; continue; }
  const rec = { persona, psycho, by: 'hand', at: new Date().toISOString().slice(0, 10) };
  ANN.byAd[id] = rec;
  ANN.byConcept[ckey(ad)] = rec;
  merged++;
}
fs.writeFileSync(path.join(ROOT, 'annotations/personas.json'), JSON.stringify(ANN, null, 1));
console.log(`merged ${merged} reads (${missing} unmatched) -> ${Object.keys(ANN.byAd).length} ad keys / ${Object.keys(ANN.byConcept).length} concept keys`);
