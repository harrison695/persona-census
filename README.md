# Persona Census

The longest-running live Meta ads from ~127 DTC brands across ten categories, each read for the
**persona** it casts and the **psychographic** it needs that person to hold.

Live site: **https://harrison695.github.io/persona-census/**
Machine-readable twin: `public/census.json`

Refreshes every Monday morning from a scheduled local run, which pushes to `main`; a GitHub
Action then publishes. **The harvest cannot run in CI** — see below.

---

## What the ranking metric is, and is not

Ads are ranked by **days running**. The Meta Ad Library exposes **no impressions and no spend**
for US commercial ads, so nothing here is a performance ranking.

Days-running measures **competitor conviction** — how long a team has been willing to keep
paying for a creative. It is a survival proxy, not a return. Cadence differs by more than 25×
between these advertisers, so longevity is comparable **within** a brand and never across the
table. Never quote it as if it were ROAS.

## Method

1. **Ladder harvest.** `AdLibrarySearchPaginationQuery` is replayed per advertiser with
   `startDate: {min, max}` set to a *descending ladder* of cutoffs (540d → 0d). Everything that
   survives a restrictive cutoff is, by definition, that brand's set of longest runners — so the
   picks are provably the oldest, not a sample. This is far cheaper than paginating a whole
   library and it is *complete*, which brute pagination is not.
2. **Dedupe** on the fbcdn content id (stable across re-signing), earliest start wins.
3. **Concept clustering** on landing path + copy fingerprint with DCO tokens stripped, so each
   brand's picks are N different *arguments* rather than N re-uploads of one idea.
4. **Persona join** — see below.
5. **Stills** are downloaded, resized to 620px webp and committed, named `<brand>_<adId>.webp`
   so the set is stable and git only churns on genuinely new creative.

### What this method does NOT measure

The ladder stops as soon as it has enough long runners, and a session can be rate-limited
part-way through a brand. So `uniq` and `concepts` in `data/harvest.json` describe **how far the
scan got**, not how much an advertiser is running — 102 of 120 brands stopped early on the last
full harvest. They are kept in the raw data because the picker needs them; they are deliberately
**not published** on the site, and no finding should be built on them.

What survives the method is each ad and the date it started. That is read directly off the record
and does not depend on scan depth.

## How personas survive a refresh

`annotations/personas.json` holds hand-written reads keyed by **both** ad id and concept key.
On each refresh an ad resolves in this order:

| order | source | badge |
|---|---|---|
| 1 | `byAd[brand_adId]` — exact same ad | `read` |
| 2 | `byConcept[key]` — same argument, re-uploaded | `read` |
| 3 | `scripts/autotag.mjs` — keyword rules | `auto` |
| 4 | nothing matched | `unread` |

`auto` and `unread` are visually distinct on the page and filterable, because naming a persona
properly means looking at the creative — a keyword rule only puts a marker down so a new ad is
not blank. **To promote an auto tag**, add the read to `annotations/personas.json` under both
`byAd` and `byConcept`; it then sticks through every future refresh.

## Why the harvest does not run in GitHub Actions

Meta serves GitHub's datacenter IPs the Ad Library page and a perfectly valid `lsd` token and
`doc_id` — and then returns **zero edges for every GraphQL query**. It does not error; it just
returns nothing. A CI run therefore *looks* successful while harvesting nothing at all.

This was verified with a live `workflow_dispatch` run: every brand, every pass, zero edges, while
the identical code on a residential connection returned 120 brands. So:

| job | where | what it does |
|---|---|---|
| `scripts/weekly.sh` | local, Mondays | harvest -> images -> build -> commit -> push |
| `.github/workflows/deploy.yml` | CI, on push | publishes `public/` to Pages |
| `.github/workflows/rebuild.yml` | CI, manual | re-renders the site from committed data (no harvest) |

**The harvester refuses to write when a run comes back empty.** If fewer than half the attempted
brands return live data, it exits non-zero and leaves the last good `harvest.json` untouched,
rather than re-stamping yesterday's data with today's date. A blocked scraper that silently
republishes stale numbers as fresh is worse than one that fails.

## Known gaps

- **Regulated health advertisers** (hims, Hers, Ro, and similar) return ads with empty media
  arrays: Meta withholds creative from logged-out sessions for those categories. They are
  reported in the build summary rather than silently dropped.
- **Rate limiting.** Meta throttles a session after roughly 30 advertisers by returning zero
  edges instead of an error. The harvester detects three consecutive zero-edge brands, cools
  down 75s, mints a fresh browser context, and runs a second pass over the suspects at the end.
- Video ads are represented by their **thumbnail**, so a video's persona is read from its
  opening frame plus its copy, not the full cut.

## Standing rule

**Port structure, never claim language.** Several brands here run claims that would not survive
another advertiser's compliance review. The layout mechanics travel; the copy does not.

## Local run

```bash
npm install                       # NOT --omit=optional: sharp's binaries are optional deps
npx playwright install chromium   # only if the cached browser version has drifted
npm run all                       # harvest -> images -> build
python3 -m http.server 8080 --directory public
```

Install the weekly schedule (once):

```bash
sed "s#__REPO__#$PWD#g" scripts/com.modern.persona-census.plist > ~/Library/LaunchAgents/com.modern.persona-census.plist
launchctl load ~/Library/LaunchAgents/com.modern.persona-census.plist
launchctl kickstart -k gui/$UID/com.modern.persona-census   # run once now to check it
```

**The repo must not live under `~/Downloads`, `~/Documents` or `~/Desktop.`** Those are
TCC-protected on macOS, and launchd cannot execute a script inside them — the agent dies with
`Operation not permitted` and exit code 126 while `launchctl kickstart` still reports success.
This repo lives at `~/Developer/persona-census` for that reason. Check `data/launchd.err.log`
if a scheduled run seems not to have happened.

Remove the schedule with:

```bash
launchctl bootout gui/$UID/com.modern.persona-census
```

Harvest a subset while iterating:

```bash
ONLY=Huel,RYZE,MarsMen npm run harvest
```

## Layout

```
roster.json               127 brands + lane map (page_ids from Motion brand-page assets)
scripts/harvest.mjs       Playwright ladder harvest -> data/harvest.json
scripts/images.mjs        signed-URL fetch + webp resize -> public/img
scripts/build.mjs         roster + harvest + annotations -> public/index.html
scripts/autotag.mjs       provisional keyword persona rules
scripts/weekly.sh         the Monday job: harvest, build, commit, push
annotations/personas.json hand-written reads (survives refreshes)
annotations/findings.json cross-brand patterns shown above the fold
.github/workflows/deploy.yml    publishes public/ on push
.github/workflows/rebuild.yml   manual re-render from committed data
```
