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
<div class="field"><span class="lab">Persona<i class="rd ${readCls}" title="${readCls === 'hand' ? 'hand-read from the creative' : readCls === 'auto' ? 'provisional keyword tag &#8212; not yet read' : 'no read yet'}">${readLbl}</i></span><p class="persona">${e(a.persona)}</p></div>
<div class="field"><span class="lab">Psychographic</span><p class="psycho">${e(a.psycho)}</p></div>
${body ? `<p class="copy">${e(body)}</p>` : ''}
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
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Archivo:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
<style>${CSS}</style></head><body>

<header class="mast"><div class="wrap">
<p class="eyebrow">Meta Ad Library census &#183; refreshed ${e(fmtDate)}</p>
<h1>Persona Census</h1>
<p class="dek">The longest-running live ads from ${brands.length} tracked competitors across ten DTC categories &#8212; each read for <strong>who it casts</strong> and <strong>what it needs them to believe</strong>. Harvested straight from Meta's Ad Library, so there is no spend and no impressions here: the ranking metric is survival.</p>
<dl class="tally">
<div><dt>Brands</dt><dd>${brands.length}</dd></div>
<div><dt>Ads profiled</dt><dd>${totalAds}</dd></div>
<div><dt>Hand-read</dt><dd>${nHand}</dd></div>
<div><dt>Longest runner</dt><dd>${maxDays}<small>d</small></dd></div>
</dl></div></header>

<section class="method"><div class="wrap">
<div><h3>How this is built</h3>
<p>Meta's Ad Library pagination query is replayed for each advertiser, filtered to ads whose <em>start date</em> precedes a descending ladder of cutoffs. Everything surviving a restrictive cutoff is by definition that brand's set of longest runners &#8212; so the picks are <strong>provably the oldest</strong>, not a sample.</p>
<p>Creatives are deduplicated on CDN content id, then clustered by <strong>concept</strong> (landing path + copy fingerprint), so each brand's cards are different <em>arguments</em> rather than re-uploads of one.</p></div>
<div class="flag"><h3>Why there are no volume figures</h3>
<p>The ladder stops as soon as it has enough long runners, and a session can be rate-limited part-way through a brand. Any count of &ldquo;creatives scanned&rdquo; is therefore a measure of <strong>how far the scan got</strong>, not of how much that advertiser is running &#8212; 102 of these 120 brands stopped early.</p>
<p>So this report deliberately publishes <strong>no creative counts, no concept ratios and no video/static splits</strong>. What survives the method is each ad and the date it started, which is measured directly and does not depend on scan depth.</p></div>
<div class="flag"><h3>What days-running is not</h3>
<p>The Ad Library exposes <strong>no impressions and no spend</strong> for US commercial ads, so nothing here is a performance ranking. Days-running measures <strong>competitor conviction</strong> &#8212; how long a team has kept paying for something &#8212; which is a survival proxy, not a return.</p>
<p>Cadence differs by more than 25&#215; across these advertisers, so longevity is only comparable <strong>within</strong> a brand, never across the table.</p></div>
<div><h3>Coverage &amp; gaps</h3>
<p><strong>${nHand}</strong> ads carry a hand-written read; <strong>${nAuto}</strong> carry a provisional keyword tag and <strong>${nNone}</strong> are unread. Filter to <em>Hand-read</em> below to see only the reviewed set.</p>
${gated.length ? `<p><strong>Media withheld:</strong> ${e(gated.slice(0, 6).join(', '))}${gated.length > 6 ? ` +${gated.length - 6} more` : ''} &#8212; Meta hides creative for regulated-health advertisers on logged-out sessions.</p>` : ''}
${noads.length ? `<p><strong>No live US ads:</strong> ${e(noads.slice(0, 6).join(', '))}${noads.length > 6 ? ` +${noads.length - 6} more` : ''}.</p>` : ''}
<p class="flag" style="border-left-width:2px;margin-top:12px"><strong>Port structure, never claim language.</strong> Several brands here run claims that would not clear another advertiser's compliance review. The mechanics travel; the copy does not.</p></div>
</div></section>

<section class="sig"><div class="wrap">
<div class="secthead"><h2>What repeats across the set</h2><p class="sub">Patterns visible only once the personas are named</p></div>
<div class="finds">${findings}</div></div></section>

<div class="bar"><div class="wrap">
<button class="chip" data-lane="*" aria-pressed="true">All lanes</button>${chips}
<div class="seg" role="group" aria-label="Media type"><button data-kind="*" aria-pressed="true">All</button><button data-kind="video" aria-pressed="false">Video</button><button data-kind="static" aria-pressed="false">Static</button></div>
<div class="seg" role="group" aria-label="Annotation state"><button data-read="*" aria-pressed="true">Any read</button><button data-read="hand" aria-pressed="false">Hand-read</button></div>
<input class="q" id="q" type="search" placeholder="Search persona or belief &#8212; try &ldquo;GLP-1&rdquo;, &ldquo;cortisol&rdquo;, &ldquo;doctor&rdquo;">
<span class="count" id="count"></span></div></div>

<main class="wrap">${lanes}<p class="empty" id="empty" hidden>No ads match that filter.</p></main>

<footer><div class="wrap">
<p><strong>Persona Census</strong> &#8212; ${totalAds} ads from ${brands.length} advertisers, harvested from the Meta Ad Library on ${e(fmtDate)}. Rosters are drawn from tracked competitor sets across ten DTC product categories. Rebuilt automatically every Monday.</p>
<p>Longevity is competitor conviction, not performance. Rank within a brand, weigh by the number of creatives behind the number, and never quote days-running as if it were return.</p>
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
