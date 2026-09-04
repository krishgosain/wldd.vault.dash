// In-memory per-IP rate limiter and short-window result cache for the live
// search endpoint (Section 11: 5-10 searches/IP/hour; cache 6-12h).
//
// This resets on cold start / is per-instance on serverless — acceptable per
// the brief ("a simple in-memory or edge-config-based limiter... is
// reasonable"). It is a best-effort abuse control, not a hard guarantee.

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS_PER_WINDOW = 8;
const CACHE_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

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
