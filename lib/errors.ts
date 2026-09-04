// Thrown by the Tavily/Gemini data pipeline (lib/fetch-brand-data.ts) when
// either provider's free-tier quota appears to be exhausted — either because
// we hit our own tracked budget (lib/quota.ts) before calling out, or
// because the provider itself returned a rate-limit/quota response. The
// live search route (app/api/search-brand/route.ts) catches this
// specifically to show a graceful "temporarily at capacity" message instead
// of a generic error.
export class QuotaExceededError extends Error {
  readonly provider: "tavily" | "gemini";

  constructor(provider: "tavily" | "gemini", message: string) {
    super(message);
    this.name = "QuotaExceededError";
    this.provider = provider;
  }
}
