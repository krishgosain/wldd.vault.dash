// In-memory per-IP rate limiter and result cache for the live search
// endpoint (Section 11, revised: 5-10 searches/IP/hour; cache 12-24h).
//
// The cache window was extended from the original 6-12h to 12-24h once the
// pipeline moved to Tavily + Gemini free tiers (see lib/fetch-brand-data.ts)
// — it's no longer just avoiding a redundant paid call, it's protecting a
// shared monthly Tavily credit pool and a shared daily Gemini request pool
// that the whole public site draws from.
//
// This resets on cold start / is per-instance on serverless — acceptable per
// the brief ("a simple in-memory or edge-config-based limiter... is
// reasonable"). It is a best-effort abuse control, not a hard guarantee.

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS_PER_WINDOW = 8;
const CACHE_TTL_MS = 18 * 60 * 60 * 1000; // 18 hours (within the 12-24h target window)

const hits = new Map<string, number[]>();

export function checkRateLimit(ip: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const timestamps = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    const oldest = timestamps[0];
    const retryAfterSeconds = Math.ceil((WINDOW_MS - (now - oldest)) / 1000);
    hits.set(ip, timestamps);
    return { allowed: false, retryAfterSeconds };
  }
  timestamps.push(now);
  hits.set(ip, timestamps);
  return { allowed: true };
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const searchCache = new Map<string, CacheEntry<unknown>>();

export function getCached<T>(key: string): T | null {
  const entry = searchCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    searchCache.delete(key);
    return null;
  }
  return entry.value as T;
}

export function setCached<T>(key: string, value: T): void {
  searchCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}
