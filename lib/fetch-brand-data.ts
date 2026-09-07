import { slugify } from "./slug";
import { QuotaExceededError } from "./errors";
import type { BrandData } from "./types";

// Two-step, free-tier data pipeline — used by both the daily refresh script
// (scripts/refresh-brands.ts) and the live search API route
// (app/api/search-brand/route.ts):
//
//   Step 1 — Search: Tavily (tavily.com) fetches clean web content for the
//            brand. Free tier: 1,000 credits/month, no card required.
//   Step 2 — Synthesis: Google Gemini (Flash or Flash-Lite ONLY — see below)
//            reasons over that text and returns the structured JSON per the
//            schema in Section 5 of the build brief. Free tier: no card,
//            roughly 5-15 requests/min and 1,000-1,500 requests/day.
//
// CRITICAL CONSTRAINT: Gemini is called with NO tools — in particular, never
// Gemini's built-in "Grounding with Google Search". That feature requires
// billing to be enabled on the Google Cloud project and costs money per
// request even within its "free" monthly quota, which defeats the entire
// point of this two-step design. All web access happens in Step 1 via
// Tavily; Gemini only ever reasons over the plain text we hand it — it never
// searches on its own.

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Must be a Flash or Flash-Lite model — those are the free-tier-eligible
// Gemini models. Do not point this at a Pro model or enable any tool use.
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
if (!/flash/i.test(GEMINI_MODEL)) {
  throw new Error(
    `GEMINI_MODEL="${GEMINI_MODEL}" is not a Flash/Flash-Lite model. Only Gemini Flash or ` +
      `Flash-Lite models are free-tier eligible for this pipeline — refusing to start with a ` +
      `different model family.`
  );
}

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  published_date?: string;
}

interface TavilySearchResponse {
  answer?: string;
  results: TavilyResult[];
}

// Step 1 — Search. One Tavily "basic" search per brand (1 credit) to keep
// the shared monthly credit pool sustainable across ~30 tracked brands
// refreshed daily plus public live searches.
async function tavilySearch(brandName: string, hint?: string): Promise<{ context: string; credits: number }> {
  if (!TAVILY_API_KEY) {
    throw new Error("TAVILY_API_KEY is not set");
  }

  const query = `${brandName} revenue operating profit marketing advertising spend stock price recent news ${hint ?? ""}`.trim();

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: TAVILY_API_KEY,
      query,
      search_depth: "basic",
      max_results: 8,
      include_answer: true,
    }),
  });

  if (res.status === 429 || res.status === 432 || res.status === 433) {
    throw new QuotaExceededError("tavily", `Tavily quota/rate limit hit (HTTP ${res.status}).`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Tavily search failed for "${brandName}": HTTP ${res.status} ${body}`);
  }

  const data = (await res.json()) as TavilySearchResponse;
  const parts: string[] = [];
  if (data.answer) parts.push(`Summary: ${data.answer}`);
  for (const r of data.results ?? []) {
    const snippet = (r.content ?? "").slice(0, 1500);
    parts.push(`Source: ${r.title}\nURL: ${r.url}\nPublished: ${r.published_date ?? "unknown"}\n${snippet}`);
  }

  return { context: parts.join("\n\n---\n\n"), credits: 1 };
}

const SCHEMA_AND_METHODOLOGY = `
You are a financial research analyst. You will be given web search results about a brand
(gathered separately — you do not have search access yourself). Using ONLY the provided context,
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
for tier 3 or 4. marketing_spend must always be populated — this is the most important field. If
the provided context doesn't contain enough signal even for Tier 4, make your best reasoned
estimate anyway and say so plainly in the derivation — never output zero or omit the field.

Every other financial field may be null with confidence "not_found" if the context doesn't
support it — do not fabricate a disclosed figure. Cite a real source URL (from the context) for
every non-null field where possible. Return ONLY the JSON object.
`;

function buildPrompt(brandName: string, hint: string | undefined, context: string): string {
  return (
    `Brand to research: "${brandName}"${hint ? `\nContext: ${hint}` : ""}\n\n` +
    `--- WEB SEARCH RESULTS (already fetched for you) ---\n${context || "(no results found)"}\n--- END WEB SEARCH RESULTS ---\n\n` +
    SCHEMA_AND_METHODOLOGY
  );
}

// Step 2 — Synthesis. Gemini reasons over the Tavily context only. No tools,
// no grounding — see the module-level comment for why that's non-negotiable.
async function geminiSynthesize(
  brandName: string,
  hint: string | undefined,
  context: string
): Promise<{ json: Record<string, unknown>; requests: number }> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: buildPrompt(brandName, hint, context) }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
          maxOutputTokens: 8192,
        },
        // Deliberately no `tools` field — Grounding with Google Search must
        // never be enabled here (it requires billing and costs money per
        // request). Gemini only reasons over the Tavily text above.
      }),
    }
  );

  if (res.status === 429) {
    throw new QuotaExceededError("gemini", "Gemini quota/rate limit hit (HTTP 429).");
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini synthesis failed for "${brandName}": HTTP ${res.status} ${body}`);
  }

  const data = await res.json();
  const finishReason = data?.candidates?.[0]?.finishReason;
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`No JSON object found in Gemini response for "${brandName}" (finishReason: ${finishReason})`);
  }

  try {
    return { json: JSON.parse(jsonMatch[0]), requests: 1 };
  } catch (err) {
    if (finishReason === "MAX_TOKENS") {
      throw new Error(
        `Gemini response for "${brandName}" was truncated before completing valid JSON (hit maxOutputTokens). ` +
          `Increase maxOutputTokens in lib/fetch-brand-data.ts if this recurs.`
      );
    }
    throw new Error(
      `Gemini returned malformed JSON for "${brandName}" (finishReason: ${finishReason}): ${(err as Error).message}`
    );
  }
}

export interface RawFetchResult {
  json: Record<string, unknown>;
  usage: { tavily_credits: number; gemini_requests: number };
}

export async function fetchBrandProfileRaw(brandName: string, hint?: string): Promise<RawFetchResult> {
  const { context, credits } = await tavilySearch(brandName, hint);
  const { json, requests } = await geminiSynthesize(brandName, hint, context);
  return { json, usage: { tavily_credits: credits, gemini_requests: requests } };
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
