/* Meta Ad Library harvester.
 * Method (see README): replay AdLibrarySearchPaginationQuery with a DESCENDING startDate
 * ladder. Anything surviving a restrictive cutoff IS that brand's longest-runner set, so the
 * top-N is provably complete rather than sampled. Then dedupe on CDN content id and cluster
 * by concept (landing path + copy fingerprint) so the picks are N different arguments. */
import fs from 'node:fs';
import path from 'node:path';
import { launch, newCtx } from './browser.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const roster = JSON.parse(fs.readFileSync(path.join(ROOT, 'roster.json'), 'utf8'));
const PICKS = Number(process.env.PICKS || 6);
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null;
const PER_BRAND_MS = Number(process.env.PER_BRAND_MS || 22000);

const SEED = 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&view_all_page_id=';

const PAGE_FN = async ({ pageId, picks, budgetMs, lsd, docId }) => {
  const stem = (u) => { try { return new URL(u).pathname.split('/').pop().replace(/\.(jpg|jpeg|png|webp|gif)$/i, ''); } catch { return String(u).slice(-40); } };
  const mkVars = (cut, cursor) => ({
    activeStatus: 'active', adType: 'ALL', audienceTimeframe: 'LAST_7_DAYS', bylines: [], collationToken: null,
    contentLanguages: [], countries: ['US'], cursor, excludedIDs: [], first: 30, isTargetedCountry: false,
    location: null, mediaType: 'all', multiCountryFilterMode: null, pageIDs: [], potentialReachInput: null,
    publisherPlatforms: [], queryString: '', regions: null, searchType: 'page', sessionID: 'h' + pageId,
    sortData: null, source: null, startDate: { min: '2015-01-01', max: cut }, viewAllPageID: pageId,
  });
  const gql = async (vars, req) => {
    const body = new URLSearchParams({ av: '0', __user: '0', __a: '1', __req: String(req), dpr: '1', __ccg: 'GOOD',
      lsd, fb_api_caller_class: 'RelayModern', fb_api_req_friendly_name: 'AdLibrarySearchPaginationQuery',
      variables: JSON.stringify(vars), server_timestamps: 'true', doc_id: docId });
    const r = await fetch('https://www.facebook.com/api/graphql/', { method: 'POST', credentials: 'include',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-fb-lsd': lsd }, body: body.toString() });
    return JSON.parse(await r.text());
  };

  const ads = new Map(); const fmts = {}; let gatedNoMedia = 0, seen = 0;
  const t0 = performance.now();
  const ladder = [540, 365, 270, 180, 120, 90, 60, 45, 30, 21, 14, 7, 0];
  const log = [];
  for (const d of ladder) {
    const cut = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
    let cursor = null, hasNext = true, pg = 0;
    while (hasNext && pg < 8) {
      if (performance.now() - t0 > budgetMs) { log.push(d + 'd:BUDGET'); break; }
      let j; try { j = await gql(mkVars(cut, cursor), 40 + pg); } catch { log.push(d + 'd:EX'); break; }
      const c = j?.data?.ad_library_main?.search_results_connection;
      if (!c) { log.push(d + 'd:ERR'); break; }
      for (const e of c.edges) for (const cr of (e.node?.collated_results || [])) {
        seen++;
        const s = cr.snapshot || {}; const f = s.display_format || '?'; fmts[f] = (fmts[f] || 0) + 1;
        const id = cr.ad_archive_id; if (!id || ads.has(id)) continue;
        const vids = [], imgs = [];
        for (const x of (s.videos || [])) if (x.video_preview_image_url) vids.push(x.video_preview_image_url);
        for (const cd of (s.cards || [])) if (cd.video_preview_image_url) vids.push(cd.video_preview_image_url);
        for (const x of (s.images || [])) { const u = x.original_image_url || x.resized_image_url; if (u) imgs.push(u); }
        for (const cd of (s.cards || [])) { const u = cd.original_image_url || cd.resized_image_url; if (u && !cd.video_preview_image_url) imgs.push(u); }
        const isV = vids.length > 0; const med = isV ? vids : imgs;
        if (!med.length) { gatedNoMedia++; continue; }
        const c0 = (s.cards || [])[0] || {};
        ads.set(id, { id, start: cr.start_date, fmt: f, kind: isV ? 'VIDEO' : 'STATIC', nA: med.length,
          url: med[0], key: stem(med[0]),
          title: (s.title || c0.title || '').replace(/\s+/g, ' ').trim().slice(0, 170),
          text: (s.body?.text || c0.body || '').replace(/\s+/g, ' ').trim().slice(0, 420),
          cta: s.cta_text || '', link: (s.link_url || '').split('?')[0].slice(0, 130),
          pageName: s.page_name || null });
      }
      cursor = c.page_info.end_cursor; hasNext = c.page_info.has_next_page; pg++;
      await new Promise(r => setTimeout(r, 190));
    }
    log.push(d + 'd=' + ads.size);
    if (ads.size >= picks * 3 || performance.now() - t0 > budgetMs) break;
  }

  // dedupe on media content id (earliest start wins), then cluster by concept
  const byMedia = new Map();
  for (const a of ads.values()) {
    const k = a.key || ('t:' + a.text.slice(0, 80));
    const p = byMedia.get(k); if (!p || a.start < p.start) byMedia.set(k, a);
  }
  const now = Date.now() / 1000;
  const uniq = [...byMedia.values()]
    .map(a => ({ ...a, days: Math.max(0, Math.floor((now - a.start) / 86400)) }))
    .sort((x, y) => y.days - x.days);
  const ckey = (a) => {
    let p = ''; try { const u = new URL(a.link); p = u.hostname.replace(/^(www|try|get|store|link|hi|us|shop|pros)\./, '') + u.pathname.replace(/\/$/, ''); } catch { p = a.link || ''; }
    const t = (a.text || '').replace(/\{\{[^}]+\}\}/g, '').replace(/[^a-z0-9 ]/gi, '').toLowerCase().trim().slice(0, 70);
    const ti = (a.title || '').replace(/\{\{[^}]+\}\}/g, '').replace(/[^a-z0-9 ]/gi, '').toLowerCase().trim().slice(0, 40);
    return p + '||' + t + '||' + ti;
  };
  const seenC = new Map();
  for (const a of uniq) { const c = ckey(a); if (!seenC.has(c)) seenC.set(c, { ...a, concept: c }); }
  const div = [...seenC.values()].sort((x, y) => y.days - x.days);
  return {
    scanned: seen, uniq: uniq.length, concepts: div.length, gatedNoMedia,
    max: uniq.length ? uniq[0].days : null,
    med: uniq.length ? uniq[Math.floor(uniq.length / 2)].days : null,
    vid: uniq.filter(a => a.kind === 'VIDEO').length,
    stat: uniq.filter(a => a.kind === 'STATIC').length,
    pageName: uniq[0]?.pageName || null, fmts, ladder: log,
    picks: div.slice(0, picks),
  };
};

(async () => {
  const browser = await launch();
  let ctx = await newCtx(browser);
  let page = await ctx.newPage();
  const scrapeOn = async (pg) => await pg.evaluate(async () => {
    const html = document.documentElement.innerHTML;
    const lsd = (html.match(/"LSD",\[\],\{"token":"([^"]+)"/) || [])[1];
    let docId = null;
    const srcs = [...new Set(performance.getEntriesByType('resource').map(e => e.name).filter(n => n.includes('.js')))];
    for (const s of srcs) { try { const t = await (await fetch(s)).text();
      if (t.includes('AdLibrarySearchPaginationQuery')) {
        const m = t.match(/"AdLibrarySearchPaginationQuery_facebookRelayOperation",\[\],\(function\([^)]*\)\{[^"]*"(\d{10,20})"/);
        if (m) { docId = m[1]; break; } } } catch {} }
    return { lsd, docId, jsCount: srcs.length, len: html.length, title: document.title };
  });

  /* Meta throttles a session after roughly 30 advertisers: the GraphQL call starts returning
     zero edges rather than an error. Detect that (scanned === 0 on a brand we expect ads for)
     and mint a completely fresh browser context before continuing. */
  async function boot(label) {
    for (let attempt = 1; attempt <= 4; attempt++) {
      const resp = await page.goto(SEED + roster.brands[0].p, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(3000 + attempt * 2500);
      const t = await scrapeOn(page);
      if (t.lsd && t.docId) { console.log(`  ${label}: http=${resp?.status()} doc_id=${t.docId}`); return t; }
      await page.waitForTimeout(3000);
    }
    return null;
  }
  async function reboot(reason) {
    console.log(`  ~ ${reason} -> cooling down 120s and re-minting session`);
    try { await ctx.close(); } catch {}
    await new Promise(r => setTimeout(r, 120000));
    ctx = await newCtx(browser); page = await ctx.newPage();
    const t = await boot('re-boot');
    if (t) COOLDOWNS++;
    return t;
  }
  let COOLDOWNS = 0;
  console.log('booting session…');
  let tok = await boot('boot');
  if (!tok) { console.error('FATAL: could not scrape lsd/doc_id after 4 attempts'); process.exit(2); }

  const list = roster.brands.filter(b => !ONLY || ONLY.has(b.k));
  const out = {};
  /* Merge into whatever is already on disk when resuming OR when harvesting a subset —
     a targeted ONLY= run must never truncate the full dataset. */
  const prevPath = path.join(ROOT, 'data/harvest.json');
  if ((process.env.RESUME === '1' || ONLY) && fs.existsSync(prevPath)) {
    const prev = JSON.parse(fs.readFileSync(prevPath, 'utf8'));
    for (const [k, v] of Object.entries(prev.brands || {})) {
      if (ONLY && ONLY.has(k)) continue;          // subset run: re-harvest these, keep the rest
      if ((v.picks || []).length || ONLY) out[k] = v;
    }
    console.log(`${ONLY ? 'subset' : 'resume'}: carrying ${Object.keys(out).length} existing brands forward`);
  }
  let blanks = 0;

  const fresh = new Set();   // brands that returned live data during THIS run
  async function doBrand(b, tag) {
    try {
      const r = await page.evaluate(PAGE_FN, { pageId: b.p, picks: PICKS, budgetMs: PER_BRAND_MS, lsd: tok.lsd, docId: tok.docId });
      out[b.k] = { ...r, key: b.k, name: b.n, lane: b.l, pageId: b.p };
      if ((r.picks || []).length) fresh.add(b.k);
      const note = r.picks.length ? '' : (r.gatedNoMedia ? `   (gated - ${r.gatedNoMedia} ads, media withheld)` : (r.scanned === 0 ? '   (NO EDGES)' : '   (no long runners)'));
      console.log(`${tag} ${b.k.padEnd(22)} ${String(r.concepts).padStart(3)}c / ${String(r.uniq).padStart(3)}u / ${String(r.max ?? '-').padStart(4)}d${note}`);
      return r;
    } catch (e) {
      out[b.k] = { key: b.k, name: b.n, lane: b.l, pageId: b.p, err: String(e).slice(0, 120), picks: [], scanned: 0 };
      console.log(`${tag} ${b.k.padEnd(22)} ERROR ${String(e).slice(0, 60)}`);
      return { scanned: 0, picks: [] };
    }
  }

  const todo = list.filter(b => !out[b.k]);
  for (let i = 0; i < todo.length; i++) {
    const r = await doBrand(todo[i], `[${i + 1}/${todo.length}]`);
    // zero edges returned = throttled, not an empty advertiser
    if (r.scanned === 0) blanks++; else blanks = 0;
    if (blanks >= 3) {
      const t = await reboot(`${blanks} consecutive zero-edge brands`);
      if (t) tok = t;
      blanks = 0;
    }
    await new Promise(r2 => setTimeout(r2, 1400));
  }

  /* Meta throttles harder the longer a run goes, so the tail of a big roster reliably comes
     back zero-edge. Sweep the survivors again with an escalating rest between passes. */
  const MAX_PASSES = Number(process.env.MAX_PASSES || 4);
  for (let pass = 2; pass <= MAX_PASSES; pass++) {
    const suspects = list.filter(b => !(out[b.k]?.picks || []).length && !out[b.k]?.gatedNoMedia);
    if (!suspects.length) break;
    const rest = 60000 * pass;
    console.log(`\npass ${pass}: ${suspects.length} brands still empty — resting ${rest / 1000}s first`);
    try { await ctx.close(); } catch {}
    await new Promise(r => setTimeout(r, rest));
    ctx = await newCtx(browser); page = await ctx.newPage();
    const t = await boot(`pass ${pass} boot`); if (t) tok = t; else continue;
    blanks = 0;
    for (let i = 0; i < suspects.length; i++) {
      const r = await doBrand(suspects[i], `[p${pass} ${i + 1}/${suspects.length}]`);
      if (r.scanned === 0) blanks++; else blanks = 0;
      if (blanks >= 3) { const t2 = await reboot(`pass ${pass} throttled`); if (t2) tok = t2; blanks = 0; }
      await new Promise(r2 => setTimeout(r2, 1500));
    }
  }
  await browser.close();
  const ok = Object.values(out).filter(o => (o.picks || []).length).length;
  const empty = Object.keys(out).length - ok;

  /* Judge THIS run, not the file it inherited, and decide BEFORE writing. A resumed or
     subset run that harvests nothing must fail loudly rather than re-stamping yesterday's
     data with today's date — that is exactly how a silently blocked scraper republishes
     stale numbers as fresh. */
  const floor = Math.max(1, Math.ceil(todo.length * 0.5));
  if (fresh.size < floor) {
    console.error(`FATAL: only ${fresh.size} of ${todo.length} attempted brands returned live data ` +
      `(floor ${floor}). Every brand coming back with zero edges means the session is blocked, ` +
      `not that the advertisers stopped running ads. Nothing written; last good harvest kept.`);
    process.exit(3);
  }

  const stamp = new Date().toISOString();
  fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'data/harvest.json'), JSON.stringify({ harvestedAt: stamp, picks: PICKS, cooldowns: COOLDOWNS, brands: out }, null, 1));
  console.log(`\nharvested ${ok} brands with data (${fresh.size}/${todo.length} fresh this run), ${empty} empty -> data/harvest.json`);
})();
