import fs from "node:fs";
import path from "node:path";

// Visible usage tracking for the two free-tier services the data pipeline
// depends on (Section 11, revised): Tavily search (shared monthly credit
// pool) and Gemini synthesis (shared daily request pool). Exceeding either
// quota doesn't cost money — it silently breaks the feature — so this is
// load-bearing, not just a nice-to-have spend log.
//
// Same filesystem caveat as before: Vercel's production filesystem is
// read-only outside /tmp, so the live search endpoint logs there
// (best-effort, resets per instance). The daily refresh job runs in GitHub
// Actions with a writable checkout and commits the log, so it's durable and
// visible in the repo.

const LOG_FILE = process.env.VERCEL
  ? path.join("/tmp", "api-usage-log.json")
  : path.join(process.cwd(), "data", "api-usage-log.json");

// Reads an env var as a non-negative integer budget. `0` is a valid,
// intentional value (e.g. "disable this pipeline"), so this deliberately
// does NOT use `Number(x) || fallback` — that treats "0" as falsy and
// silently overrides it with the default, which would be a fail-open bug.
function envBudget(value: string | undefined, fallback: number): number {
  if (value === undefined || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

// Tavily's free tier is ~1,000 credits/month, no card required. A basic
// search costs 1 credit. We budget under that to leave headroom for
// whatever else might be pulling from the same key.
const TAVILY_MONTHLY_CREDIT_BUDGET = envBudget(process.env.TAVILY_MONTHLY_CREDIT_BUDGET, 900);

// Gemini's free tier (Flash / Flash-Lite) is roughly 1,000-1,500
// requests/day depending on model. Budget conservatively under that.
const GEMINI_DAILY_REQUEST_BUDGET = envBudget(process.env.GEMINI_DAILY_REQUEST_BUDGET, 900);

export interface UsageLogEntry {
  timestamp: string;
  source: "daily_refresh" | "live_search";
  brand: string;
  tavily_credits: number;
  gemini_requests: number;
}

interface UsageLog {
  entries: UsageLogEntry[];
}

function readLog(): UsageLog {
  if (!fs.existsSync(LOG_FILE)) return { entries: [] };
  try {
    return JSON.parse(fs.readFileSync(LOG_FILE, "utf-8"));
  } catch {
    return { entries: [] };
  }
}

function writeLog(log: UsageLog): void {
  const dir = path.dirname(LOG_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2) + "\n");
}

export function logUsage(entry: Omit<UsageLogEntry, "timestamp">): void {
  const log = readLog();
  log.entries.push({ ...entry, timestamp: new Date().toISOString() });
  // Keep the log from growing unbounded — 90 days is plenty to see monthly trends.
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  log.entries = log.entries.filter((e) => new Date(e.timestamp).getTime() > cutoff);
  writeLog(log);
}

function isSameUtcDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

function isSameUtcMonth(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
}

export interface UsageSummary {
  tavilyCreditsToday: number;
  tavilyCreditsThisMonth: number;
  geminiRequestsToday: number;
  geminiRequestsThisMonth: number;
  tavilyBudgetRemaining: number;
  geminiBudgetRemaining: number;
}

export function getUsageSummary(): UsageSummary {
  const log = readLog();
  const now = new Date();
  let tavilyCreditsToday = 0;
  let tavilyCreditsThisMonth = 0;
  let geminiRequestsToday = 0;
  let geminiRequestsThisMonth = 0;

  for (const e of log.entries) {
    const t = new Date(e.timestamp);
    if (isSameUtcMonth(t, now)) {
      tavilyCreditsThisMonth += e.tavily_credits;
      geminiRequestsThisMonth += e.gemini_requests;
      if (isSameUtcDay(t, now)) {
        tavilyCreditsToday += e.tavily_credits;
        geminiRequestsToday += e.gemini_requests;
      }
    }
  }

  return {
    tavilyCreditsToday,
    tavilyCreditsThisMonth,
    geminiRequestsToday,
    geminiRequestsThisMonth,
    tavilyBudgetRemaining: TAVILY_MONTHLY_CREDIT_BUDGET - tavilyCreditsThisMonth,
    geminiBudgetRemaining: GEMINI_DAILY_REQUEST_BUDGET - geminiRequestsToday,
  };
}

// Proactive check, before spending anything on this call — cheaper than
// waiting for the provider to reject the request.
export function checkQuotaAvailable(): { ok: true } | { ok: false; provider: "tavily" | "gemini" } {
  const summary = getUsageSummary();
  if (summary.tavilyBudgetRemaining <= 0) return { ok: false, provider: "tavily" };
  if (summary.geminiBudgetRemaining <= 0) return { ok: false, provider: "gemini" };
  return { ok: true };
}
