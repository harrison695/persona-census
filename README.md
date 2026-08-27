# Persona Census

The longest-running live Meta ads from ~127 DTC brands across ten categories, each read for the
**persona** it casts and the **psychographic** it needs that person to hold.

Live site: **https://harrison695.github.io/persona-census/**
Machine-readable twin: `public/census.json`

Rebuilds itself every Monday 06:20 UTC via GitHub Actions.

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
npm install
npx playwright install chromium   # only if the cached browser version has drifted
npm run all                       # harvest -> images -> build
python3 -m http.server 8080 --directory public
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
annotations/personas.json hand-written reads (survives refreshes)
annotations/findings.json cross-brand patterns shown above the fold
.github/workflows/refresh.yml   Monday cron
```
