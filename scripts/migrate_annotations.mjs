/* One-off: lift the 145 hand-written persona/psychographic reads from the first build
 * into the persistent annotation store, keyed by BOTH ad id and concept. */
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
import { ckey } from './ckey.mjs';
const ROOT = path.resolve(import.meta.dirname, '..');
const src = path.join(os.homedir(), 'Downloads/winning_ads_report/build/data.json');
const rows = JSON.parse(fs.readFileSync(src, 'utf8')).filter(r => !r._hdr);
const store = { byAd: {}, byConcept: {} };
for (const r of rows) {
  if (!r.persona) continue;
  const rec = { persona: r.persona, psycho: r.psycho, by: 'hand', at: '2026-08-26' };
  store.byAd[`${r.brand}_${r.id}`] = rec;
  store.byConcept[ckey({ link: r.link, text: r.text, title: r.title })] = rec;
}
fs.mkdirSync(path.join(ROOT, 'annotations'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'annotations/personas.json'), JSON.stringify(store, null, 1));
console.log(`migrated ${Object.keys(store.byAd).length} ad keys / ${Object.keys(store.byConcept).length} concept keys`);
