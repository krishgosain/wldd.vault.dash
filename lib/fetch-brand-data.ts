import Anthropic from "@anthropic-ai/sdk";
import { slugify } from "./slug";
import type { BrandData } from "./types";

// Shared "ask Claude, with live web search, for a brand's financial profile"
// call — used by both the daily refresh script (scripts/refresh-brands.ts)
// and the live search API route (app/api/search-brand/route.ts). Section 3
// of the build brief specifies this as the single data-sourcing mechanism.

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

const SCHEMA_AND_METHODOLOGY = `
You are a financial research analyst. Research the brand named below using web search and
return ONLY a single JSON object (no prose, no markdown fences) matching this TypeScript shape:

{
  "name": string,
  "parent": string | null,
  "entity_type": "public_standalone" | "public_parent" | "india_private_registered" | "foreign_private",
  "category": string,               // e.g. "OTT", "Auto", "Ride-hailing", "Consumer Tech"
  "description": string,            // one sentence: what this brand actually is, spelling out
                                     // the parent relationship if it's a subsidiary/product-of-a-listed-company
  "stock": {
    "applicable": boolean,          // true only if this specific brand/company has its own ticker
    "value": number | null,
    "currency": string,
    "ticker": string | null,
    "as_of": string | null,         // ISO date
    "note": string,                 // e.g. "reflects parent company, not this brand specifically"
    "confidence": "disclosed" | "not_applicable"
  },
  "revenue": {
    "value": number | null,
    "currency": string,
    "period": string,               // e.g. "FY2025", "Q4 2025"
    "confidence": "disclosed" | "press_estimate" | "not_found",
    "source": { "name": string, "url": string, "date": string } | null
  },
  "operating_profit": { /* same shape as revenue */ },
  "expenses": {
    "breakdown": [ { "label": string, "value": number, "confidence": "disclosed" | "modeled" } ],
    "confidence": "disclosed" | "press_estimate" | "not_found"
  },
  "marketing_spend": {
    "value_low": number,
    "value_high": number,
    "currency": string,
    "period": string,
    "tier": "1_disclosed" | "2_industry_benchmark" | "3_modeled" | "4_triangulated",
    "derivation": string,           // plain-language explanation of how this number was reached
    "source": { "name": string, "url": string, "date": string } | null
  },
  "trend_history": {
    "stock": [ { "date": string, "value": number } ],      // recent points if findable, else []
    "revenue": [ { "period": string, "value": number } ]   // recent points if findable, else []
  },
  "business_updates": [
    { "headline": string, "date": string, "source": { "name": string, "url": string } }
  ]
}

MARKETING SPEND METHODOLOGY — apply exactly this logic, in this order, and never leave
marketing_spend blank or null:

Tier 1 — Disclosed. Check the company's financial statements (Indian MCA/Schedule III filings,
or SEC 10-K/10-Q for US filers) for a separately disclosed marketing/advertising expense line
("Advertisement and sales promotion expense", "Business promotion expense",
"Demand creation expense", "Sales & marketing expense"). If found, tier = "1_disclosed", value_low
= value_high = that figure, derivation is just the filing citation.

Tier 2 — Industry benchmark (PMAR). If not disclosed, check whether the brand or its Indian
parent appears in the most recent Pitch Madison Advertising Report (PMAR) with an AdEx range.
If named, tier = "2_industry_benchmark", derivation cites the PMAR edition/year.

Tier 3 — Modeled. If neither of the above, but revenue or user-growth figures exist, apply
either a revenue-ratio method (category-typical marketing-to-revenue % sourced from credible
industry/startup press commentary — cite where the ratio came from) or a CAC-based method
(new users x a reported/estimated CAC for that vertical). tier = "3_modeled", derivation shows
the formula and inputs in 1-2 plain sentences.

Tier 4 — Triangulated (lowest confidence, but NEVER blank). If none of the above apply, take
PMAR's category-level total ad spend and divide by the brand's estimated share of category
visibility (estimated from campaign-mention frequency in ad-trade press — exchange4media, afaqs,
campaignindia, socialsamosa, bestmediainfo — relative to 2-3 named competitors in the same
category over the trailing 12 months). tier = "4_triangulated", derivation states the category
total used and how the visibility share was estimated. This tier must still produce a concrete
range.

Rule: always use the highest tier available. Never blend tiers. Never omit the derivation string
for tier 3 or 4. marketing_spend must always be populated — this is the most important field.

Every other financial field may be null with confidence "not_found" if nothing credible is found
— do not fabricate a disclosed figure. Cite a real source URL for every non-null field where
possible. Return ONLY the JSON object.
`;

function buildPrompt(brandName: string, hint?: string) {
  return `Brand to research: "${brandName}"${hint ? `\nContext: ${hint}` : ""}\n\n${SCHEMA_AND_METHODOLOGY}`;
}

export interface RawFetchResult {
  json: Record<string, unknown>;
  usage: { input_tokens: number; output_tokens: number };
}

export async function fetchBrandProfileRaw(
  brandName: string,
  hint?: string
): Promise<RawFetchResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 6,
      } as unknown as Anthropic.Tool,
    ],
    messages: [{ role: "user", content: buildPrompt(brandName, hint) }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  const text = textBlock && "text" in textBlock ? textBlock.text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`No JSON object found in model response for "${brandName}"`);
  }
  const json = JSON.parse(jsonMatch[0]);

  return {
    json,
    usage: {
      input_tokens: message.usage?.input_tokens ?? 0,
      output_tokens: message.usage?.output_tokens ?? 0,
    },
  };
}

// Normalizes the raw model JSON (which may be missing fields or slightly
// off-shape) into a valid BrandData record.
export function normalizeBrandData(
  brandName: string,
  raw: Record<string, unknown>,
  opts: { liveSearch?: boolean } = {}
): BrandData {
  const r: Record<string, unknown> = raw;

  const financial = (f: unknown): BrandData["revenue"] => {
    const obj = (f as Record<string, unknown>) || {};
    return {
      value: typeof obj.value === "number" ? obj.value : null,
      currency: typeof obj.currency === "string" ? obj.currency : "USD",
      period: typeof obj.period === "string" ? obj.period : "",
      confidence:
        obj.confidence === "disclosed" || obj.confidence === "press_estimate"
          ? obj.confidence
          : "not_found",
      source: (obj.source as BrandData["revenue"]["source"]) ?? null,
    };
  };

  const marketing = (m: unknown) => {
    const obj = (m as Record<string, unknown>) || {};
    const validTiers = ["1_disclosed", "2_industry_benchmark", "3_modeled", "4_triangulated"];
    return {
      value_low: typeof obj.value_low === "number" ? obj.value_low : 0,
      value_high: typeof obj.value_high === "number" ? obj.value_high : 0,
      currency: typeof obj.currency === "string" ? obj.currency : "USD",
      period: typeof obj.period === "string" ? obj.period : "",
      tier: validTiers.includes(obj.tier as string)
        ? (obj.tier as BrandData["marketing_spend"]["tier"])
        : "4_triangulated",
      derivation:
        typeof obj.derivation === "string" && obj.derivation.length > 0
          ? obj.derivation
          : "Insufficient signal to derive a confident estimate; treat this range as a rough placeholder pending the next refresh.",
      source: (obj.source as BrandData["marketing_spend"]["source"]) ?? null,
    };
  };

  const stockRaw = (r.stock as Record<string, unknown>) || {};
  const expensesRaw = (r.expenses as Record<string, unknown>) || {};
  const trendRaw = (r.trend_history as Record<string, unknown>) || {};

  return {
    name: typeof r.name === "string" && r.name ? r.name : brandName,
    slug: slugify(brandName),
    parent: typeof r.parent === "string" ? r.parent : null,
    entity_type: (r.entity_type as BrandData["entity_type"]) ?? "foreign_private",
    category: typeof r.category === "string" ? r.category : "Uncategorized",
    description: typeof r.description === "string" ? r.description : "",
    last_refreshed: new Date().toISOString(),
    stock: {
      applicable: Boolean(stockRaw.applicable),
      value: typeof stockRaw.value === "number" ? stockRaw.value : null,
      currency: typeof stockRaw.currency === "string" ? stockRaw.currency : "USD",
      ticker: typeof stockRaw.ticker === "string" ? stockRaw.ticker : null,
      as_of: typeof stockRaw.as_of === "string" ? stockRaw.as_of : null,
      note: typeof stockRaw.note === "string" ? stockRaw.note : "",
      confidence: stockRaw.applicable ? "disclosed" : "not_applicable",
    },
    revenue: financial(r.revenue),
    operating_profit: financial(r.operating_profit),
    expenses: {
      breakdown: Array.isArray(expensesRaw.breakdown)
        ? (expensesRaw.breakdown as BrandData["expenses"]["breakdown"])
        : [],
      confidence:
        expensesRaw.confidence === "disclosed" || expensesRaw.confidence === "press_estimate"
          ? (expensesRaw.confidence as BrandData["expenses"]["confidence"])
          : "not_found",
    },
    marketing_spend: marketing(r.marketing_spend),
    trend_history: {
      stock: Array.isArray(trendRaw.stock)
        ? (trendRaw.stock as BrandData["trend_history"]["stock"])
        : [],
      revenue: Array.isArray(trendRaw.revenue)
        ? (trendRaw.revenue as BrandData["trend_history"]["revenue"])
        : [],
    },
    business_updates: Array.isArray(r.business_updates)
      ? (r.business_updates as BrandData["business_updates"])
      : [],
    ...(opts.liveSearch ? { live_search: true } : {}),
  };
}

export async function fetchBrandProfile(
  brandName: string,
  hint?: string,
  opts: { liveSearch?: boolean } = {}
): Promise<{ brand: BrandData; usage: RawFetchResult["usage"] }> {
  const { json, usage } = await fetchBrandProfileRaw(brandName, hint);
  return { brand: normalizeBrandData(brandName, json, opts), usage };
}
