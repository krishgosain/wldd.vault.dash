import type { MarketingSpendField, MarketingTier, SourceRef } from "./types";

// The four-tier marketing-spend estimation methodology (BUILD BRIEF Section 6).
// Always resolves to a concrete value_low/value_high — never null. Called by
// both the daily refresh script (scripts/refresh-brands.ts) and the live
// search API route (app/api/search-brand/route.ts) once each has gathered
// whatever raw signals it could find via web search.
//
// Rule: use the highest tier available. Never blend tiers. Never emit a
// Tier 3/4 result without a populated derivation string.

export interface DisclosedInput {
  value: number;
  currency: string;
  period: string;
  source: SourceRef;
}

export interface BenchmarkInput {
  value_low: number;
  value_high: number;
  currency: string;
  period: string;
  pmarEdition: string; // e.g. "PMAR 2025"
  sourceUrl: string;
}

export interface ModeledInput {
  method: "revenue_ratio" | "cac";
  currency: string;
  period: string;
  // revenue_ratio inputs
  revenue?: number;
  ratioPct?: number; // e.g. 6 for 6%
  ratioSourceName?: string;
  ratioSourceUrl?: string;
  // cac inputs
  newUsers?: number;
  cacValue?: number;
  cacSourceName?: string;
  cacSourceUrl?: string;
}

export interface TriangulatedInput {
  currency: string;
  period: string;
  categoryTotal: number;
  categoryLabel: string; // e.g. "quick-commerce AdEx"
  pmarEdition: string;
  estimatedSharePctLow: number;
  estimatedSharePctHigh: number;
  competitorNames: string[]; // 2-3 named competitors used for the visibility comparison
  visibilitySourceNames: string[]; // e.g. ["exchange4media", "afaqs"]
}

export function resolveMarketingSpend(input: {
  disclosed?: DisclosedInput;
  benchmark?: BenchmarkInput;
  modeled?: ModeledInput;
  triangulated?: TriangulatedInput;
}): MarketingSpendField {
  if (input.disclosed) return tier1(input.disclosed);
  if (input.benchmark) return tier2(input.benchmark);
  if (input.modeled) return tier3(input.modeled);
  if (input.triangulated) return tier4(input.triangulated);
  throw new Error(
    "resolveMarketingSpend: no tier input supplied — Tier 4 (triangulated) must always be reachable as a fallback, so this indicates a caller bug, not missing data."
  );
}

function tier1(d: DisclosedInput): MarketingSpendField {
  return {
    value_low: d.value,
    value_high: d.value,
    currency: d.currency,
    period: d.period,
    tier: "1_disclosed" as MarketingTier,
    derivation: `Disclosed in ${d.source.name} (${d.period}).`,
    source: d.source,
  };
}

function tier2(b: BenchmarkInput): MarketingSpendField {
  return {
    value_low: b.value_low,
    value_high: b.value_high,
    currency: b.currency,
    period: b.period,
    tier: "2_industry_benchmark",
    derivation: `Named in ${b.pmarEdition} (Pitch Madison Advertising Report) with an AdEx range for this period.`,
    source: { name: b.pmarEdition, url: b.sourceUrl, date: b.period },
  };
}

function tier3(m: ModeledInput): MarketingSpendField {
  if (m.method === "revenue_ratio") {
    const revenue = m.revenue ?? 0;
    const ratioPct = m.ratioPct ?? 0;
    const mid = (revenue * ratioPct) / 100;
    return {
      value_low: round(mid * 0.8),
      value_high: round(mid * 1.2),
      currency: m.currency,
      period: m.period,
      tier: "3_modeled",
      derivation: `Modeled as ${ratioPct}% of ${m.period} revenue (${formatNum(revenue)} ${m.currency}), using a category-typical marketing-to-revenue ratio reported by ${m.ratioSourceName ?? "industry press"}.`,
      source: m.ratioSourceUrl
        ? { name: m.ratioSourceName ?? "Industry press", url: m.ratioSourceUrl, date: m.period }
        : null,
    };
  }
  const newUsers = m.newUsers ?? 0;
  const cac = m.cacValue ?? 0;
  const mid = newUsers * cac;
  return {
    value_low: round(mid * 0.75),
    value_high: round(mid * 1.25),
    currency: m.currency,
    period: m.period,
    tier: "3_modeled",
    derivation: `Modeled as ${formatNum(newUsers)} new users x a CAC of ${cac} ${m.currency}, sourced from ${m.cacSourceName ?? "vertical benchmark reporting"}.`,
    source: m.cacSourceUrl
      ? { name: m.cacSourceName ?? "Vertical CAC benchmark", url: m.cacSourceUrl, date: m.period }
      : null,
  };
}

function tier4(t: TriangulatedInput): MarketingSpendField {
  const low = round((t.categoryTotal * t.estimatedSharePctLow) / 100);
  const high = round((t.categoryTotal * t.estimatedSharePctHigh) / 100);
  const competitors = t.competitorNames.slice(0, 3).join(", ");
  return {
    value_low: low,
    value_high: high,
    currency: t.currency,
    period: t.period,
    tier: "4_triangulated",
    derivation:
      `No disclosed figure, PMAR listing, or reliable revenue/user base to model from. Triangulated from ${t.pmarEdition}'s ` +
      `total ${t.categoryLabel} of ${formatNum(t.categoryTotal)} ${t.currency}, apportioned by an estimated ${t.estimatedSharePctLow}-${t.estimatedSharePctHigh}% ` +
      `category-visibility share. Share was estimated from campaign-mention frequency in ${t.visibilitySourceNames.join(", ")} ` +
      `over the trailing 12 months, relative to ${competitors || "named category competitors"}.`,
    source: null,
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatNum(n: number): string {
  return n.toLocaleString("en-US");
}
