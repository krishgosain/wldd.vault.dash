// Bootstraps /data/brands/*.json for every entry in lib/brands.ts with
// schema-valid placeholder data, so the site has something to render before
// the first real daily refresh runs (which needs TAVILY_API_KEY and
// GEMINI_API_KEY — see scripts/refresh-brands.ts and lib/fetch-brand-data.ts).
//
// This does NOT fabricate real financials: every field starts as
// null/"not_found" except marketing_spend, which the schema requires to
// always be populated (Section 5) — here it's an explicitly-labeled
// placeholder, not a researched figure. Run `npm run refresh` afterwards
// (with both API keys set) to replace every brand with real, cited data.
//
// Safe to re-run: it only writes a brand file if one doesn't already exist,
// so it never clobbers real refreshed data.

import { BRAND_CONFIG, brandSlug } from "../lib/brands";
import { readBrandFile, writeBrandFile } from "../lib/data";
import type { BrandData } from "../lib/types";

function placeholderDescription(name: string, parent: string | null, entityType: string): string {
  if (parent) {
    return `${name} is a brand/product of ${parent}.`;
  }
  const kind =
    entityType === "public_standalone"
      ? "a publicly listed company"
      : entityType === "india_private_registered"
      ? "an India-registered private company"
      : "a privately held company";
  return `${name} is ${kind}. Description pending first data refresh.`;
}

function currencyFor(entityType: string): string {
  return entityType === "india_private_registered" ? "INR" : "USD";
}

function buildPlaceholder(entry: (typeof BRAND_CONFIG)[number]): BrandData {
  const slug = brandSlug(entry);
  const currency = currencyFor(entry.entity_type);
  const isPublic = entry.entity_type === "public_standalone" || entry.entity_type === "public_parent";
  const ticker = entry.ticker ?? entry.parent_ticker ?? null;

  return {
    name: entry.name,
    slug,
    parent: entry.parent,
    entity_type: entry.entity_type,
    category: entry.category,
    description: placeholderDescription(entry.name, entry.parent, entry.entity_type),
    last_refreshed: new Date(0).toISOString(), // epoch marks "never refreshed"
    stock: {
      applicable: isPublic,
      value: null,
      currency,
      ticker,
      as_of: null,
      note: isPublic
        ? entry.entity_type === "public_parent"
          ? "Reflects the listed parent company, not this brand specifically. Awaiting first refresh."
          : "Awaiting first refresh."
        : "Privately held — no public stock.",
      confidence: isPublic ? "disclosed" : "not_applicable",
    },
    revenue: { value: null, currency, period: "", confidence: "not_found", source: null },
    operating_profit: { value: null, currency, period: "", confidence: "not_found", source: null },
    expenses: { breakdown: [], confidence: "not_found" },
    marketing_spend: {
      value_low: 0,
      value_high: 0,
      currency,
      period: "",
      tier: "4_triangulated",
      derivation:
        "Placeholder — this brand has not yet been through a live data refresh, so no real marketing-spend estimate exists yet. Run `npm run refresh` with TAVILY_API_KEY and GEMINI_API_KEY set (or wait for the next scheduled 09:00 IST run) to replace this with a researched, tiered estimate per the Section 6 methodology.",
      source: null,
    },
    trend_history: { stock: [], revenue: [] },
    business_updates: [],
  };
}

function main() {
  let created = 0;
  for (const entry of BRAND_CONFIG) {
    const slug = brandSlug(entry);
    if (readBrandFile(slug)) continue; // never overwrite real/refreshed data
    writeBrandFile(slug, buildPlaceholder(entry));
    created += 1;
  }
  console.log(`Seeded ${created} placeholder brand file(s) (skipped ${BRAND_CONFIG.length - created} already present).`);
}

main();
