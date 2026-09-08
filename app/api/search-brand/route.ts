import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getCached, setCached } from "@/lib/rate-limit";
import { fetchBrandProfile } from "@/lib/fetch-brand-data";
import { logUsage, checkQuotaAvailable } from "@/lib/quota";
import { QuotaExceededError } from "@/lib/errors";
import { slugify } from "@/lib/slug";
import type { BrandData } from "@/lib/types";

export const runtime = "nodejs";

const CAPACITY_MESSAGE = "Live search is temporarily at capacity — try again later.";

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name")?.trim();
  if (!name) {
    return NextResponse.json({ error: "Missing ?name= query parameter." }, { status: 400 });
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit(ip);
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: `Rate limit reached. Try again in about ${Math.ceil((rl.retryAfterSeconds ?? 3600) / 60)} minute(s).`,
      },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds ?? 3600) } }
    );
  }

  const cacheKey = slugify(name);
  const cached = getCached<BrandData>(cacheKey);
  if (cached) {
    return NextResponse.json({ brand: cached, cached: true });
  }

  if (!process.env.TAVILY_API_KEY || !process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "Live search is not configured (TAVILY_API_KEY / GEMINI_API_KEY missing)." },
      { status: 503 }
    );
  }

  // Proactive check against our own tracked budgets, before spending
  // anything on this call — see lib/quota.ts.
  const quota = checkQuotaAvailable();
  if (!quota.ok) {
    return NextResponse.json({ error: CAPACITY_MESSAGE }, { status: 503 });
  }

  try {
    const { brand, usage } = await fetchBrandProfile(name, undefined, { liveSearch: true });
    setCached(cacheKey, brand);
    try {
      logUsage({
        source: "live_search",
        brand: name,
        tavily_credits: usage.tavily_credits,
        gemini_requests: usage.gemini_requests,
      });
    } catch {
      // best-effort logging only — never fail the request over it
    }
    return NextResponse.json({ brand, cached: false });
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      // Reactive case: our own budget looked fine, but the provider itself
      // rejected the call as over quota/rate-limited.
      console.warn(`${err.provider} quota exceeded on live search for "${name}"`);
      return NextResponse.json({ error: CAPACITY_MESSAGE }, { status: 503 });
    }
    console.error("live search failed", err);
    return NextResponse.json(
      { error: `Couldn't generate a profile for "${name}" right now. Please try again shortly.` },
      { status: 502 }
    );
  }
}
