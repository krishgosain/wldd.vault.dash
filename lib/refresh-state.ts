import fs from "node:fs";
import path from "node:path";

// Tracks where the daily refresh left off, so a quota cutoff strands a
// different tail of the portfolio each day instead of always the same
// brands. Without this, BRAND_CONFIG's fixed order means Gemini's real
// free-tier daily quota (which runs out well before reaching the end of the
// ~32-brand list) always stops at the same point, and every brand after
// that point never gets refreshed.
const STATE_FILE = path.join(process.cwd(), "data", "refresh-state.json");

interface RefreshState {
  nextStartSlug: string | null;
}

export function readNextStartSlug(): string | null {
  if (!fs.existsSync(STATE_FILE)) return null;
  try {
    const state = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8")) as RefreshState;
    return state.nextStartSlug ?? null;
  } catch {
    return null;
  }
}

export function writeNextStartSlug(slug: string | null): void {
  const dir = path.dirname(STATE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const state: RefreshState = { nextStartSlug: slug };
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + "\n");
}
