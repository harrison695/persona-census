import fs from 'node:fs'; import path from 'node:path';
import { ckey } from './ckey.mjs'; import { autotag } from './autotag.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const roster = JSON.parse(fs.readFileSync(path.join(ROOT, 'roster.json'), 'utf8'));
const H = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/harvest.json'), 'utf8'));
const ANN = fs.existsSync(path.join(ROOT, 'annotations/personas.json'))
  ? JSON.parse(fs.readFileSync(path.join(ROOT, 'annotations/personas.json'), 'utf8')) : { byAd: {}, byConcept: {} };
const FIND = JSON.parse(fs.readFileSync(path.join(ROOT, 'annotations/findings.json'), 'utf8'));
const DIMS = fs.existsSync(path.join(ROOT, 'data/imgdims.json'))
  ? JSON.parse(fs.readFileSync(path.join(ROOT, 'data/imgdims.json'), 'utf8')) : {};

const e = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ascii = s => [...s].map(c => c.codePointAt(0) < 128 ? c : `&#${c.codePointAt(0)};`).join('');
const pathOf = u => { try { const p = '/' + u.split('//')[1].split('/').slice(1).join('/'); return p.length > 46 ? p.slice(0, 46) + '…' : p; } catch { return '/'; } };

let nHand = 0, nAuto = 0, nNone = 0;
const brands = [];
for (const b of roster.brands) {
  const h = H.brands[b.k];
  if (!h || !(h.picks || []).length) continue;
  const ads = h.picks.map(a => {
    const c = ckey(a);
    const rec = ANN.byAd[`${b.k}_${a.id}`] || ANN.byConcept[c] || autotag(a);
    if (rec.by === 'hand') nHand++; else if (rec.by === 'auto') nAuto++; else nNone++;
    const imgFile = `img/${b.k}_${a.id}.webp`;
    const d = DIMS[`${b.k}_${a.id}`];
    return { ...a, ...rec, concept: c, w: d?.[0] || 620, h: d?.[1] || 775,
             img: fs.existsSync(path.join(ROOT, 'public', imgFile)) ? imgFile : null };
  }).filter(a => a.img);
  if (ads.length) brands.push({ ...b, h, ads });
}

const totalAds = brands.reduce((s, b) => s + b.ads.length, 0);
const totalUniq = brands.reduce((s, b) => s + (b.h.uniq || 0), 0);
const totalConc = brands.reduce((s, b) => s + (b.h.concepts || 0), 0);
const maxDays = Math.max(...brands.map(b => b.h.max || 0));
const gated = Object.values(H.brands).filter(b => !(b.picks || []).length && b.gatedNoMedia > 0).map(b => b.name);
const noads = Object.values(H.brands).filter(b => !(b.picks || []).length && !b.gatedNoMedia && !b.err).map(b => b.name);

const card = a => {
  const kind = a.kind === 'VIDEO' ? 'video' : 'static';
  const tok = !a.title || a.title.startsWith('{{');
  const body = (a.text || '').startsWith('{{') ? '' : a.text;
  const readCls = a.by === 'hand' ? 'hand' : (a.by === 'auto' ? 'auto' : 'none');
  const readLbl = a.by === 'hand' ? 'read' : (a.by === 'auto' ? 'auto' : 'unread');
  return `<article class="ad" data-kind="${kind}" data-read="${readCls}" data-s="${e((a.persona + ' ' + a.psycho + ' ' + (a.title || '') + ' ' + body).toLowerCase())}">
<div class="shot" style="aspect-ratio:${a.w}/${a.h}"><img src="${a.img}" alt="${e(a.persona)}" width="${a.w}" height="${a.h}" loading="lazy" decoding="async"><span class="fmt ${kind}">${kind === 'video' ? '&#9654; VIDEO' : 'STATIC'}</span><span class="run"><b>${a.days}</b>d</span></div>
<div class="meat">
<h4${tok ? ' class="tok"' : ''}>${tok ? '&#8212; dynamic (DCO) &#8212;' : e(a.title)}</h4>
<div class="field"><span class="lab">Persona${a.by === 'hand' ? '' : `<i class="rd ${readCls}" title="${readCls === 'auto' ? 'provisional keyword tag &#8212; not yet read' : 'no read yet'}">${readLbl}</i>`}</span><p class="persona">${e(a.persona)}</p></div>
<div class="field"><span class="lab">Psychographic</span><p class="psycho">${e(a.psycho)}</p></div>
${body ? `<p class="copy">${e(body.length > 165 ? body.slice(0,165).replace(/\s+\S*$/,'') + '\u2026' : body)}</p>` : ''}
<div class="foot"><span class="cta">${e(a.cta || '&#8212;')}</span><span class="lp" title="${e(a.link)}">${e(pathOf(a.link))}</span><a class="src" href="https://www.facebook.com/ads/library/?id=${a.id}" target="_blank" rel="noopener">Library &#8599;</a></div>
</div></article>`;
};

const brandBlock = b => `<section class="brand" id="b-${b.k.toLowerCase()}">
<header class="bh"><h3>${e(b.n)}</h3><dl class="stats">
<div><dt>Longest run</dt><dd class="num">${b.h.max}<small>d</small></dd></div>
<div><dt>Ads shown</dt><dd class="num">${b.ads.length}</dd></div>
</dl></header>
<div class="grid">${b.ads.map(card).join('')}</div></section>`;

const lanes = roster.lanes.map(L => {
  const bs = brands.filter(b => b.l === L.id);
  if (!bs.length) return '';
  const n = bs.reduce((s, b) => s + b.ads.length, 0);
  return `<section class="lane" data-lane="${e(L.id)}">
<div class="lh"><h2>${e(L.name)}</h2><p class="sub">${e(L.sub)} &#183; ${bs.length} brands &#183; ${n} ads</p></div>
${bs.map(brandBlock).join('')}</section>`;
}).join('');

const chips = roster.lanes.filter(L => brands.some(b => b.l === L.id))
  .map(L => `<button class="chip" data-lane="${e(L.id)}">${e(L.name)}</button>`).join('');
const findings = FIND.map(f => `<article class="find"><h3>${f.t}</h3><p>${f.d}</p></article>`).join('');

const stamp = new Date(H.harvestedAt);
const fmtDate = stamp.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

const CSS = fs.readFileSync(path.join(ROOT, 'scripts/site.css'), 'utf8');
const JSS = fs.readFileSync(path.join(ROOT, 'scripts/site.js'), 'utf8');

const DOC = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Persona Census</title>
<meta name="description" content="The longest-running live Meta ads from ${brands.length} DTC brands, each read for the persona it casts and the belief it needs them to hold.">
<meta property="og:title" content="Persona Census"><meta property="og:description" content="${totalAds} surviving Meta ads from ${brands.length} DTC brands, tagged by persona and psychographic.">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%F0%9F%8E%AD%3C/text%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,700;1,9..40,400&family=DM+Mono:wght@400;500&display=swap">
<style>${CSS}</style></head><body>

<header class="mast"><div class="blob"></div><div class="wrap">
<p class="eyebrow">Meta Ad Library &#183; refreshed ${e(fmtDate)}</p>
<h1>Persona Census</h1>
<div class="rule"></div>
<p class="dek">${totalAds} ads still running across ${brands.length} DTC brands. Every one read for <b>who it casts</b> and <b>what it needs them to believe</b>.</p>
<dl class="tally">
<div><dt>Brands</dt><dd>${brands.length}</dd></div>
<div><dt>Ads profiled</dt><dd>${totalAds}</dd></div>
<div><dt>Hand-read</dt><dd>${nHand}</dd></div>
<div><dt>Longest runner</dt><dd>${maxDays}<small>d</small></dd></div>
</dl></div></header>

<section class="method"><div class="wrap">
<div class="mcard"><h3>Method</h3>
<p>Ladder Meta's Ad Library by <b>start date</b>, oldest cutoff first. Whatever survives is that brand's longest runner &#8212; provably, not sampled.</p>
<p>Dedupe on CDN content id, then cluster by concept, so each brand's cards are different <em>arguments</em>.</p></div>

<div class="mcard flag"><h3>Days running is not performance</h3>
<p>The Ad Library exposes <b>no spend and no impressions</b> for US commercial ads. This measures how long a team kept paying &#8212; conviction, not return.</p>
<p>Cadence differs 25&#215; here. Compare <b>within</b> a brand, never across the table.</p></div>

<div class="mcard flag"><h3>No volume figures</h3>
<p>The scan stops once it has the long runners; 102 of 120 brands stopped early. Any creative count would measure <b>the scrape</b>, not the advertiser.</p>
<p>${nHand === totalAds ? `All ${totalAds} personas are hand-read. Nothing here is keyword-guessed.` : `${nHand} hand-read, ${nAuto} auto-tagged, ${nNone} unread.`}</p></div>
</div></section>

<section class="sig"><div class="wrap">
<div class="secthead"><h2>What <em>repeats</em></h2></div>
<div class="finds">${findings}</div></div></section>

<div class="bar"><div class="wrap">
<button class="chip" data-lane="*" aria-pressed="true">All lanes</button>${chips}
<div class="seg" role="group" aria-label="Media type"><button data-kind="*" aria-pressed="true">All</button><button data-kind="video" aria-pressed="false">Video</button><button data-kind="static" aria-pressed="false">Static</button></div>
${nHand < totalAds ? '<div class="seg" role="group" aria-label="Annotation state"><button data-read="*" aria-pressed="true">Any read</button><button data-read="hand" aria-pressed="false">Hand-read</button></div>' : ''}
<input class="q" id="q" type="search" placeholder="Search persona or belief &#8212; try &ldquo;GLP-1&rdquo;, &ldquo;cortisol&rdquo;, &ldquo;doctor&rdquo;">
<span class="count" id="count"></span></div></div>

<main class="wrap">${lanes}<p class="empty" id="empty" hidden>No ads match that filter.</p></main>

<footer><div class="wrap">
<p><b>Persona Census</b> &#8212; ${totalAds} ads, ${brands.length} advertisers, harvested ${e(fmtDate)}. Rebuilt every Monday.</p>
<p>Longevity is conviction, not return. Rank within a brand. Never quote days-running as ROAS.</p>
</div></footer>
<script>${JSS}</script></body></html>`;

fs.mkdirSync(path.join(ROOT, 'public'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'public/index.html'), ascii(DOC));
fs.writeFileSync(path.join(ROOT, 'public/.nojekyll'), '');
// machine-readable twin so the data is reusable without scraping the page
fs.writeFileSync(path.join(ROOT, 'public/census.json'), JSON.stringify({
  harvestedAt: H.harvestedAt, brands: brands.length, ads: totalAds,
  note: 'Per-ad days are measured directly. No creative-volume counts are published: the harvest ladder stops early, so any such count reflects scan depth, not advertiser volume.',
  rows: brands.flatMap(b => b.ads.map(a => ({
    brand: b.n, lane: b.l, adId: a.id, days: a.days, kind: a.kind,
    title: a.title, persona: a.persona, psychographic: a.psycho, readBy: a.by,
    landing: a.link, adLibrary: `https://www.facebook.com/ads/library/?id=${a.id}` }))),
}, null, 1));
console.log(`built: ${brands.length} brands, ${totalAds} ads (${nHand} hand / ${nAuto} auto / ${nNone} unread) -> public/index.html`);
