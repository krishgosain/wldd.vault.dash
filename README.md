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
  cron `30 3 * * *` UTC = 09:00 IST) runs the two-step data pipeline below
  once per tracked brand, writes/commits the updated JSON.
- **Live search** — `app/api/search-brand/route.ts`, a Next.js API route
  that does the same live, for any brand typed into the search bar, without
  writing to the repo.
- **Charts** — Recharts.

## The data pipeline: Tavily + Gemini (two decoupled free-tier steps)

Both the daily refresh and live search go through the same two-step pipeline
(`lib/fetch-brand-data.ts`), called in sequence:

1. **Search — Tavily.** One `api.tavily.com/search` call per brand fetches
   clean, already-parsed web content (titles, URLs, snippets, an AI answer
   summary). Free tier: 1,000 credits/month, no card required. A basic
   search costs 1 credit, so this pipeline uses exactly 1 credit per
   brand-fetch.
2. **Synthesis — Gemini (Flash / Flash-Lite only).** Tavily's results are
   handed to Gemini as plain text context in the prompt, and Gemini returns
   the structured JSON matching the Section 5 schema, applying the Section 6
   marketing-spend tier methodology itself. Free tier: no card, roughly
   5-15 requests/min and 1,000-1,500 requests/day depending on model.

**Critical constraint:** Gemini is called with no `tools` at all — in
particular, **never** Gemini's built-in "Grounding with Google Search".
That feature requires billing to be enabled on the Google Cloud project and
costs money per request even inside its nominal "free" monthly quota, which
would defeat the entire point of routing search through Tavily. All web
access happens in step 1 (Tavily); Gemini only ever reasons over the text
we hand it — it never searches on its own. `lib/fetch-brand-data.ts` also
refuses to start if `GEMINI_MODEL` doesn't match `/flash/i`, as a guardrail
against accidentally pointing this at a paid Pro model.

## Getting started

```bash
npm install
npm run seed        # bootstraps /data/brands with schema-valid placeholders
npm run dev          # http://localhost:3000
```

The placeholder seed data lets the site render immediately. To populate real,
cited figures, set `TAVILY_API_KEY` and `GEMINI_API_KEY` (see `.env.example`)
and run:

```bash
npm run refresh                        # all tracked brands
npm run refresh -- --only=netflix,tcs  # a subset, useful for testing
```

## Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `TAVILY_API_KEY` | GitHub Actions secret + Vercel env | Step 1 (search) of the data pipeline. Free tier: 1,000 credits/month, no card. |
| `GEMINI_API_KEY` | GitHub Actions secret + Vercel env | Step 2 (synthesis) of the data pipeline. Free tier: no card, ~1,000-1,500 requests/day. |
| `GEMINI_MODEL` | optional, defaults to `gemini-2.5-flash` | Must be a Flash/Flash-Lite model — the pipeline refuses to start otherwise. |
| `TAVILY_MONTHLY_CREDIT_BUDGET` | optional, defaults to `900` | Safety threshold `lib/quota.ts` checks before spending another Tavily credit. |
| `GEMINI_DAILY_REQUEST_BUDGET` | optional, defaults to `900` | Safety threshold `lib/quota.ts` checks before spending another Gemini request. |
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

The daily refresh and live search both ask Gemini (reasoning over the Tavily
search context — see "The data pipeline" above) to apply this same
methodology and return the tier + a plain-language `derivation` string,
which the UI shows in a "How we got this number" expandable panel under the
marketing-spend tile (and under any other Tier 3/4 figure).

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

## Cost and quota controls (Section 11, revised)

This is a public site with an open search bar that triggers real calls
against two shared free-tier quotas (Tavily's monthly credit pool, Gemini's
daily request pool). Unlike a metered paid API, exceeding either quota
doesn't just cost money — it silently breaks live search for everyone until
the quota resets. Controls in place:

- **Rate limiting** — `lib/rate-limit.ts` caps live search to 8 requests per
  IP per rolling hour (in-memory; best-effort on serverless, resets per
  instance/cold start).
- **Caching** — live search results are cached for **18 hours** per brand
  name (within the 12-24h target window), so repeat searches for the same
  brand don't re-spend Tavily/Gemini quota. This window was widened from the
  original 6-12h once the pipeline moved to shared free tiers rather than a
  pay-per-token API — the cache is now protecting a monthly credit pool, not
  just avoiding a redundant paid call.
- **Quota tracking** — `lib/quota.ts` appends every call's Tavily
  credit(s)/Gemini request(s) to a simple JSON log (`data/api-usage-log.json`
  for the daily refresh job, committed to the repo and durable;
  `/tmp/api-usage-log.json` for the live search endpoint on Vercel, since
  Vercel's production filesystem is read-only outside `/tmp` — best-effort
  only, resets per instance) and exposes `getUsageSummary()` /
  `checkQuotaAvailable()` so both the refresh script and the API route can
  see today's/this month's usage against a configurable safety budget
  (`TAVILY_MONTHLY_CREDIT_BUDGET`, `GEMINI_DAILY_REQUEST_BUDGET`).
- **Graceful "at capacity" state** — if either budget check fails
  proactively, or Tavily/Gemini themselves reject a call as
  rate-limited/over-quota (`QuotaExceededError` in `lib/errors.ts`), the
  search API returns HTTP 503 and the search bar shows *"Live search is
  temporarily at capacity — try again later"* — never a raw error or a hang.
  The daily refresh job applies the same check between brands and simply
  stops early, leaving the rest for the next scheduled run, rather than
  hammering an exhausted provider.

**Free hosting vs. free-but-quota-capped data pipeline:** Vercel's free tier
and GitHub Actions' free minutes cover hosting and scheduling at no cost.
Tavily and Gemini's free tiers cover the data pipeline at no cost too — but
"free" here means capped, not unlimited: ~32 daily-refresh calls/day plus
every live search all draw from the same monthly Tavily credit pool and
daily Gemini request pool. Monitor `data/api-usage-log.json` to see how much
headroom is left before either cap is hit.

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
