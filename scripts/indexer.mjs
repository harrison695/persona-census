/* Map each ad onto three closed dimensions (annotations/taxonomy.json).
 *
 * SOURCE OF TRUTH is annotations/index_map.tsv -- a hand-written assignment per distinct
 * persona. Keyword matching was tried first and abandoned: it hit 85% coverage but the labels
 * were wrong (a glovebox stocker classified as an unsayable symptom), because a bag of words
 * fires on incidental vocabulary. The regexes in taxonomy.json survive ONLY as a suggestion
 * for personas that have no hand mapping yet -- new creative from a refresh -- and anything
 * resolved that way is flagged `suggested` rather than presented as indexed.
 *
 * annotations/index_ads.tsv overrides the persona map for a single ad. A persona names a
 * person, not a moment -- the same buyer shows up in different circumstances across ads, so
 * an ad-level read wins over the persona-level default wherever one exists. The two tiers
 * publish distinct labels (`hand-ad` vs `hand-persona`): an inherited default carries a
 * persona-wide blast radius when its map row is wrong, so it must stay distinguishable. */
import fs from 'node:fs'; import path from 'node:path';
const ROOT = path.resolve(import.meta.dirname, '..');
const T = JSON.parse(fs.readFileSync(path.join(ROOT, 'annotations/taxonomy.json'), 'utf8'));
const NAME = Object.fromEntries([...T.jobs, ...T.mechanisms, ...T.casting].map(x => [x.id, x.name]));

const MAP = {};
for (const line of fs.readFileSync(path.join(ROOT, 'annotations/index_map.tsv'), 'utf8').split('\n')) {
  const [persona, job, mechs, casting] = line.split('\t');
  if (!persona || !job) continue;
  MAP[persona.trim()] = { job: job.trim(), mechanisms: (mechs || '').split(',').map(s => s.trim()).filter(Boolean), casting: (casting || '').trim() };
}

const AD = {};
const adFile = path.join(ROOT, 'annotations/index_ads.tsv');
if (fs.existsSync(adFile)) {
  for (const line of fs.readFileSync(adFile, 'utf8').split('\n')) {
    const [id, job, mechs, casting] = line.split('\t');
    if (!id || !job) continue;
    AD[id.trim()] = { job: job.trim(), mechanisms: (mechs || '').split(',').map(s => s.trim()).filter(Boolean), casting: (casting || '').trim() };
  }
}

function suggest(ad) {
  const hay = `${ad.persona || ''} ${ad.psychographic || ad.psycho || ''} ${ad.title || ''} ${ad.text || ''}`;
  const best = (list) => { let b = null, bs = 0;
    for (const x of list) { const n = (hay.match(new RegExp(x.match, 'gi')) || []).length; if (n > bs) { bs = n; b = x.id; } }
    return b; };
  return { job: best(T.jobs), mechanisms: [best(T.mechanisms)].filter(Boolean), casting: best(T.casting), indexBy: 'suggested' };
}

export function indexAd(ad) {
  const adHit = AD[ad.key], mapHit = MAP[ad.persona];
  const r = adHit ? { ...adHit, indexBy: 'hand-ad' }
    : mapHit ? { ...mapHit, indexBy: 'hand-persona' }
    : suggest(ad);
  return { ...r,
    jobName: NAME[r.job] || null,
    mechanismNames: (r.mechanisms || []).map(m => NAME[m]).filter(Boolean),
    castingName: NAME[r.casting] || null };
}
export const TAXONOMY = T;
