import fs from "node:fs";
import path from "node:path";
import type { BrandData } from "./types";

const DATA_DIR = path.join(process.cwd(), "data", "brands");

export function listTrackedSlugs(): string[] {
  if (!fs.existsSync(DATA_DIR)) return [];
  return fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
}

export function readBrandFile(slug: string): BrandData | null {
  const file = path.join(DATA_DIR, `${slug}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as BrandData;
  } catch {
    return null;
  }
}

export function listAllBrands(): BrandData[] {
  return listTrackedSlugs()
    .map((slug) => readBrandFile(slug))
    .filter((b): b is BrandData => b !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function writeBrandFile(slug: string, data: BrandData): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, `${slug}.json`), JSON.stringify(data, null, 2) + "\n");
}

const NEVER_REFRESHED = new Date(0).toISOString();

export function latestRefreshTimestamp(brands: BrandData[]): string | null {
  const times = brands
    .map((b) => b.last_refreshed)
    .filter((t) => Boolean(t) && t !== NEVER_REFRESHED)
    .sort();
  return times.length ? times[times.length - 1] : null;
}

export function isNeverRefreshed(timestamp: string): boolean {
  return !timestamp || timestamp === NEVER_REFRESHED;
}
