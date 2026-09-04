// One-time historical backfill (BUILD BRIEF Section 10). Reads a CSV of
// past-year figures for one brand and merges them into that brand's
// trend_history — without touching anything the daily refresh job owns
// (last_refreshed, current revenue/marketing_spend/etc).
//
// Usage:
//   npm run import-historical -- --slug=philips-india --file=./philips.csv
//
// CSV format (header row required), one row per period:
//   period,revenue,operating_profit,marketing_spend
//   FY2022,45000000,3200000,2100000
//   FY2023,51000000,3800000,2400000
//   FY2024,58000000,4100000,2650000
//
// - `period` becomes the x-axis label for the revenue trend chart.
// - `revenue` is required; `operating_profit` and `marketing_spend` are
//   read but only `revenue` currently feeds a chart (Section 5's
//   trend_history only tracks stock + revenue) — the other two columns are
//   still recorded so future chart types can use them without a re-import.
// - Numbers only, no currency symbols or thousands separators.
// - A brand's JSON file must already exist (from the seed data or a prior
//   refresh) before you can import history into it.

import fs from "node:fs";
import path from "node:path";
import { readBrandFile, writeBrandFile } from "../lib/data";
import type { TrendPoint } from "../lib/types";

interface HistoricalRow {
  period: string;
  revenue: number;
  operating_profit: number | null;
  marketing_spend: number | null;
}

function parseCsv(content: string): HistoricalRow[] {
  const lines = content.trim().split(/\r?\n/);
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idx = (col: string) => header.indexOf(col);
  const periodIdx = idx("period");
  const revenueIdx = idx("revenue");
  const opIdx = idx("operating_profit");
  const mktIdx = idx("marketing_spend");

  if (periodIdx === -1 || revenueIdx === -1) {
    throw new Error("CSV must have at least 'period' and 'revenue' columns.");
  }

  return lines.slice(1).map((line, i) => {
    const cols = line.split(",").map((c) => c.trim());
    const revenue = Number(cols[revenueIdx]);
    if (!cols[periodIdx] || Number.isNaN(revenue)) {
      throw new Error(`Row ${i + 2}: 'period' and numeric 'revenue' are required.`);
    }
    return {
      period: cols[periodIdx],
      revenue,
      operating_profit: opIdx !== -1 && cols[opIdx] ? Number(cols[opIdx]) : null,
      marketing_spend: mktIdx !== -1 && cols[mktIdx] ? Number(cols[mktIdx]) : null,
    };
  });
}

function main() {
  const slugArg = process.argv.find((a) => a.startsWith("--slug="));
  const fileArg = process.argv.find((a) => a.startsWith("--file="));
  if (!slugArg || !fileArg) {
    console.error("Usage: npm run import-historical -- --slug=<brand-slug> --file=<path.csv>");
    process.exit(1);
  }
  const slug = slugArg.replace("--slug=", "");
  const file = path.resolve(fileArg.replace("--file=", ""));

  const brand = readBrandFile(slug);
  if (!brand) {
    console.error(
      `No existing data file for slug "${slug}" — create it first (seed data or a refresh run) before importing history.`
    );
    process.exit(1);
  }

  const csv = fs.readFileSync(file, "utf-8");
  const rows = parseCsv(csv);

  const revenuePoints: TrendPoint[] = rows.map((r) => ({ period: r.period, value: r.revenue }));
  const existingByPeriod = new Map<string, TrendPoint>();
  for (const p of brand.trend_history.revenue) existingByPeriod.set(String(p.period), p);
  for (const p of revenuePoints) {
    // Historical import never overwrites a point the daily refresh already
    // wrote for the same period — it only fills gaps.
    if (!existingByPeriod.has(String(p.period))) existingByPeriod.set(String(p.period), p);
  }
  brand.trend_history.revenue = Array.from(existingByPeriod.values()).sort((a, b) =>
    String(a.period).localeCompare(String(b.period))
  );

  writeBrandFile(slug, brand);
  console.log(`Imported ${rows.length} historical period(s) into ${slug}.json`);
}

main();
