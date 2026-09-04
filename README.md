# WLDD Rev Tracker

A public financial-intelligence site tracking ~30 curated brands (public
companies, India-registered private companies, and foreign private
companies), refreshed daily, plus a live "search any brand" feature. Every
number carries a visible confidence label — **Disclosed**, **Industry
benchmark**, **Modeled**, or **Triangulated** — so nothing looks more
certain than it actually is.

## Stack

- **Next.js (App Router)** — statically-generated/ISR'd portfolio + brand
  pages, deployed to Vercel's free tier.
- **Data storage** — JSON files in `/data/brands/{slug}.json`, one per
  tracked brand, committed to the repo. No database.
- **Daily refresh** — GitHub Actions (`.github/workflows/daily-refresh.yml`,
  cron `30 3 * * *` UTC = 09:00 IST) calls the Anthropic API with the
  `web_search` tool once per tracked brand, writes/commits the updated JSON.
- **Live search** — `app/api/search-brand/route.ts`, a Next.js API route
  that does the same live, for any brand typed into the search bar, without
  writing to the repo.
- **Charts** — Recharts.

## Getting started

```bash
npm install
npm run seed        # bootstraps /data/brands with schema-valid placeholders
npm run dev          # http://localhost:3000
```

The placeholder seed data lets the site render immediately. To populate real,
cited figures, set `ANTHROPIC_API_KEY` and run:

```bash
npm run refresh                        # all tracked brands
npm run refresh -- --only=netflix,tcs  # a subset, useful for testing
```

## Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | GitHub Actions secret + Vercel env | Powers both the daily refresh job and the live search endpoint. **This is billed per token — see Cost below.** |
| `ANTHROPIC_MODEL` | optional, defaults to `claude-sonnet-5` | Override the model used for research calls. |
| `VERCEL_DEPLOY_HOOK_URL` | GitHub Actions repo variable, optional | If set, the daily refresh workflow pings this to trigger a redeploy after committing new data. |

## The marketing-spend methodology

Every brand must show a marketing-spend figure — it is never left blank.
`lib/marketing-spend.ts` implements the four-tier fallback chain exactly as
specified:

1. **Disclosed** — a separately-reported ad/marketing expense line in
   filings (MCA/Schedule III or SEC 10-K/10-Q).
2. **Industry benchmark** — named in the latest Pitch Madison Advertising
   Report (PMAR) with an AdEx range.
3. **Modeled** — a revenue-ratio or CAC-based estimate, with the ratio/CAC
   source cited.
4. **Triangulated** — PMAR category-level AdEx apportioned by an estimated
   share of category ad-trade-press visibility vs. 2-3 named competitors.
   This tier always resolves to a concrete range — it is the guaranteed
   floor.

The daily refresh and live search both ask Claude (with live web search) to
apply this same methodology and return the tier + a plain-language
`derivation` string, which the UI shows in a "How we got this number"
expandable panel under the marketing-spend tile (and under any other
Tier 3/4 figure).

## Historical data import

`scripts/import-historical.ts` merges past-year figures into a brand's
`trend_history.revenue` without touching anything the daily refresh job
owns. It never overwrites a period the refresh job already wrote — it only
fills gaps.

```bash
npm run import-historical -- --slug=philips-india --file=./philips.csv
```

CSV format (header row required):

```csv
period,revenue,operating_profit,marketing_spend
FY2022,45000000,3200000,2100000
FY2023,51000000,3800000,2400000
FY2024,58000000,4100000,2650000
```

- `period` and `revenue` are required; numbers only, no currency symbols or
  thousands separators.
- The brand's JSON file must already exist (from `npm run seed` or a prior
  refresh) before importing history into it.
- Candidates supplied by the user: Philips India, Paper Boat, Agilitas,
  Rapido, JioHotstar — spreadsheets/PDFs pending.

## Adding a tracked brand

Add one entry to `BRAND_CONFIG` in `lib/brands.ts` — no other code change is
required. Run `npm run seed` (to get a placeholder immediately) and/or
`npm run refresh -- --only=<new-slug>` to populate it.

## Cost and abuse controls (Section 11)

This is a public site with an open search bar that triggers real,
pay-per-token Anthropic API calls. Controls in place:

- **Rate limiting** — `lib/rate-limit.ts` caps live search to 8 requests per
  IP per rolling hour (in-memory; best-effort on serverless, resets per
  instance/cold start).
- **Caching** — live search results are cached for 8 hours per brand name,
  so repeat searches for the same brand don't re-trigger the API.
- **Spend logging** — `lib/spend-log.ts` appends every call's token usage to
  a simple JSON log (`data/api-spend-log.json` for the daily refresh job,
  committed to the repo and durable; `/tmp/api-spend-log.json` for the live
  search endpoint on Vercel, since Vercel's production filesystem is
  read-only outside `/tmp` — best-effort only, resets per instance).

**Free hosting vs. non-free API usage:** Vercel's free tier and GitHub
Actions' free minutes cover hosting and scheduling at no cost. The
Anthropic API calls underneath — ~18-30 calls/day from the refresh job,
plus every live search — are billed per token and are an ongoing operating
cost, not a one-time build cost. Monitor `data/api-spend-log.json` (and
Vercel's function logs for live search) to keep an eye on this.

## Open decisions (flagged, not guessed)

1. **Live search brands are one-off by default** — a brand typed into
   search is never added to the tracked/daily-refresh list automatically,
   so the portfolio doesn't grow unbounded from anonymous public searches.
   Change this by writing the live search route's result to
   `/data/brands/` and appending the brand to `lib/brands.ts` if you want
   the opposite behavior.
2. **The ~30-brand portfolio** — Section 4 of the build brief supplied 18
   brands and asked for ~12 more to reach ~30; `lib/brands.ts` includes a
   proposed set (Zepto, Swiggy, PhonePe, Nykaa, boAt, Zerodha, CRED,
   Meesho, Ola Electric, Uber, Duolingo, Instagram) spanning the same mix
   of public/India-private/foreign-private entity types. Swap or extend
   this list freely — it's one array, no code change needed.
3. **Repo name** — this build lives in the existing `wldd.vault.dash`
   repository rather than a new `wldd-revtracker` repo, since that's where
   this session was invoked.
4. **Historical data** — the import script and CSV format above are ready;
   actual spreadsheets/PDFs for Philips India, Paper Boat, Agilitas,
   Rapido, and JioHotstar still need to be supplied and run through it.

## Design

Colors and layout are derived from wldd.in's palette (sampled from its
production CSS): primary blue `#5271FF`, near-black `#131313`, off-white
`#F5F5F5`, plus green/amber/red/magenta accents — see the CSS custom
properties in `app/globals.css`. Confidence badges always pair an icon with
a color (never color alone) for colorblind-safe accessibility.
