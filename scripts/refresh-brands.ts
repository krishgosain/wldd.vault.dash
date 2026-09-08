// Daily refresh job (BUILD BRIEF Section 3 + 12, pipeline revised per
// Section 3 update). For each tracked brand in lib/brands.ts, runs the
// Tavily search -> Gemini synthesis pipeline (lib/fetch-brand-data.ts) once,
// normalizes the response into the Section 5 schema, and writes/overwrites
// that brand's /data/brands/{slug}.json — preserving any historical trend
// points already on disk (from a manual historical import, see
// scripts/import-historical.ts) rather than clobbering them.
//
// Run via: npm run refresh            (all tracked brands)
//          npm run refresh -- --only=netflix,tcs   (subset, for testing)
//
// Invoked on a schedule by .github/workflows/daily-refresh.yml.

import "dotenv/config";
import { BRAND_CONFIG, brandSlug } from "../lib/brands";
import { fetchBrandProfile } from "../lib/fetch-brand-data";
import { readBrandFile, writeBrandFile } from "../lib/data";
import { logUsage, checkQuotaAvailable, getUsageSummary } from "../lib/quota";
import { QuotaExceededError } from "../lib/errors";
import type { BrandData, TrendPoint } from "../lib/types";

function mergeTrend(existing: TrendPoint[], incoming: TrendPoint[], key: "date" | "period"): TrendPoint[] {
  const byKey = new Map<string, TrendPoint>();
  for (const p of existing) byKey.set(String(p[key]), p);
  for (const p of incoming) byKey.set(String(p[key]), p); // fresh data wins on overlap
  return Array.from(byKey.values()).sort((a, b) => String(a[key]).localeCompare(String(b[key])));
}

async function refreshOne(name: string, hint: string | undefined, slug: string) {
  process.stdout.write(`Refreshing ${name}... `);
  const existing = readBrandFile(slug);

  const { brand, usage } = await fetchBrandProfile(name, hint, { liveSearch: false });
  brand.slug = slug;

  if (existing) {
    brand.trend_history.stock = mergeTrend(existing.trend_history.stock, brand.trend_history.stock, "date");
    brand.trend_history.revenue = mergeTrend(
      existing.trend_history.revenue,
      brand.trend_history.revenue,
      "period"
    );
  }

  writeBrandFile(slug, brand as BrandData);
  logUsage({
    source: "daily_refresh",
    brand: name,
    tavily_credits: usage.tavily_credits,
    gemini_requests: usage.gemini_requests,
  });
  console.log(`done (tier=${brand.marketing_spend.tier})`);
}

async function main() {
  const onlyArg = process.argv.find((a) => a.startsWith("--only="));
  const only = onlyArg ? new Set(onlyArg.replace("--only=", "").split(",")) : null;

  const targets = BRAND_CONFIG.filter((b) => !only || only.has(brandSlug(b)));
  if (targets.length === 0) {
    console.log("No matching brands to refresh.");
    return;
  }

  let failures = 0;
  let skippedForQuota = 0;

  for (let i = 0; i < targets.length; i++) {
    const entry = targets[i];

    // Stop spending once our tracked Tavily/Gemini budget looks exhausted —
    // better to leave the rest for tomorrow's run than to hammer a
    // provider that's about to start rejecting calls anyway.
    const quota = checkQuotaAvailable();
    if (!quota.ok) {
      skippedForQuota = targets.length - i;
      console.warn(
        `\nStopping early: ${quota.provider} budget looks exhausted for this period. ` +
          `${skippedForQuota} brand(s) remaining will run on the next scheduled refresh.`
      );
      break;
    }

    const slug = brandSlug(entry);
    const hint = [
      entry.parent ? `Parent/owner: ${entry.parent}.` : "",
      entry.ticker ? `Ticker: ${entry.ticker}.` : "",
      entry.parent_ticker ? `Parent ticker: ${entry.parent_ticker}.` : "",
      entry.cin ? `India CIN: ${entry.cin}.` : "",
      entry.note ? `Note: ${entry.note}` : "",
      `Entity type: ${entry.entity_type}.`,
      `Category: ${entry.category}.`,
    ]
      .filter(Boolean)
      .join(" ");

    try {
      await refreshOne(entry.name, hint, slug);
    } catch (err) {
      if (err instanceof QuotaExceededError) {
        skippedForQuota = targets.length - i;
        console.warn(`\n${err.provider} rejected the call as over quota for ${entry.name}; stopping early.`);
        break;
      }
      failures += 1;
      console.error(`\nFailed to refresh ${entry.name}:`, err instanceof Error ? err.message : err);
    }
  }

  const summary = getUsageSummary();
  console.log(
    `\nUsage so far — Tavily: ${summary.tavilyCreditsThisMonth} credits this month ` +
      `(${summary.tavilyBudgetRemaining} remaining of budget), Gemini: ${summary.geminiRequestsToday} requests today ` +
      `(${summary.geminiBudgetRemaining} remaining of budget).`
  );

  const attempted = targets.length - skippedForQuota;
  if (failures > 0) {
    console.error(`${failures} of ${attempted} attempted brand(s) failed to refresh.`);
    process.exitCode = 1;
  } else if (skippedForQuota > 0) {
    console.log(`Refreshed ${attempted} brand(s); ${skippedForQuota} deferred to the next run due to quota.`);
  } else {
    console.log(`All ${targets.length} brand(s) refreshed successfully.`);
  }
}

main();
