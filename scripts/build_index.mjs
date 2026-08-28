import fs from 'node:fs'; import path from 'node:path';
import { indexAd } from './indexer.mjs';
const ROOT = path.resolve(import.meta.dirname, '..');
const c = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/census.json'), 'utf8'));
const T = JSON.parse(fs.readFileSync(path.join(ROOT, 'annotations/taxonomy.json'), 'utf8'));
const out = c.rows.map(r => ({ ...r, ...indexAd(r) }));
const tally = (k) => { const t = {}; for (const r of out) { const v = r[k]; if (Array.isArray(v)) v.forEach(x => t[x] = (t[x]||0)+1); else t[v] = (t[v]||0)+1; } return t; };
const pct = n => Math.round(100*n/out.length);
const show = (title, t, defs) => {
  console.log(`\n${title}`);
  for (const [k,v] of Object.entries(t).sort((a,b)=>b[1]-a[1])) {
    const nm = defs?.find(d=>d.id===k)?.name || k;
    console.log(`  ${String(v).padStart(4)}  ${String(pct(v)).padStart(3)}%  ${nm}`);
  }
};
show('JOB (one per ad)', tally('job'), T.jobs);
show('MECHANISM (multi-label)', tally('mechanisms'), T.mechanisms);
show('CASTING (one per ad)', tally('casting'), T.casting);
show('SOURCE', tally('by'));
fs.writeFileSync(path.join(ROOT, 'data/indexed.json'), JSON.stringify(out, null, 1));
