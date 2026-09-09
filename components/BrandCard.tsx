import Link from "next/link";
import type { BrandData } from "@/lib/types";
import { formatMoney } from "@/lib/format";

export default function BrandCard({ brand }: { brand: BrandData }) {
  const stockSeries = brand.trend_history?.stock ?? [];
  let trend: { dir: "up" | "down" | "flat"; pct: number } | null = null;
  if (stockSeries.length >= 2) {
    const last = stockSeries[stockSeries.length - 1].value;
    const prev = stockSeries[stockSeries.length - 2].value;
    const pct = prev ? ((last - prev) / Math.abs(prev)) * 100 : 0;
    trend = { dir: last === prev ? "flat" : last > prev ? "up" : "down", pct };
  }
  const latestUpdate = brand.business_updates?.[0];

  return (
    <Link
      href={`/brand/${brand.slug}`}
      className="block rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-xs font-bold text-white">
            {brand.name.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">{brand.name}</p>
            <p className="text-[11px] text-muted">{brand.category}</p>
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted">
          {brand.entity_type === "public_standalone" || brand.entity_type === "public_parent"
            ? "Public"
            : "Private"}
        </span>
      </div>

      <div className="mt-3 flex items-baseline justify-between">
        {brand.stock.applicable ? (
          <span className="text-lg font-semibold">
            {formatMoney(brand.stock.value, brand.stock.currency)}
          </span>
        ) : (
          <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-xs font-medium text-muted">
            {brand.entity_type === "public_parent" ? "Not separately listed" : "Private"}
          </span>
        )}
        {trend && trend.dir !== "flat" && (
          <span
            className={`text-xs font-medium ${trend.dir === "up" ? "text-positive" : "text-negative"}`}
          >
            {trend.dir === "up" ? "▲" : "▼"} {Math.abs(trend.pct).toFixed(1)}%
          </span>
        )}
      </div>

      {latestUpdate && (
        <p className="mt-2 line-clamp-2 text-xs text-muted">{latestUpdate.headline}</p>
      )}
    </Link>
  );
}
