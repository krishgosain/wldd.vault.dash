import fs from "node:fs";
import path from "node:path";

// A simple, visible counter of Anthropic API spend from both the daily
// refresh job and the live search endpoint (Section 11). Not a database —
// just an append-friendly JSON file so token/API cost is monitorable rather
// than a surprise.

// Vercel's production filesystem is read-only outside /tmp, so the live
// search endpoint (which runs there) logs to /tmp — best-effort, resets per
// instance. The daily refresh job runs in GitHub Actions with a writable
// checkout, so it logs into the repo where it's committed and durable.
const LOG_FILE = process.env.VERCEL
  ? path.join("/tmp", "api-spend-log.json")
  : path.join(process.cwd(), "data", "api-spend-log.json");

export interface SpendLogEntry {
  timestamp: string;
  source: "daily_refresh" | "live_search";
  brand: string;
  input_tokens: number;
  output_tokens: number;
}

interface SpendLog {
  entries: SpendLogEntry[];
  totals: { input_tokens: number; output_tokens: number; calls: number };
}

function readLog(): SpendLog {
  if (!fs.existsSync(LOG_FILE)) {
    return { entries: [], totals: { input_tokens: 0, output_tokens: 0, calls: 0 } };
  }
  try {
    return JSON.parse(fs.readFileSync(LOG_FILE, "utf-8"));
  } catch {
    return { entries: [], totals: { input_tokens: 0, output_tokens: 0, calls: 0 } };
  }
}

export function logSpend(entry: Omit<SpendLogEntry, "timestamp">): void {
  const log = readLog();
  const full: SpendLogEntry = { ...entry, timestamp: new Date().toISOString() };
  log.entries.push(full);
  // Keep the log from growing unbounded — retain the most recent 2000 calls.
  if (log.entries.length > 2000) log.entries = log.entries.slice(-2000);
  log.totals.input_tokens += entry.input_tokens;
  log.totals.output_tokens += entry.output_tokens;
  log.totals.calls += 1;

  const dir = path.dirname(LOG_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2) + "\n");
}
