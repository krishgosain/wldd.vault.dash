"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { BrandData } from "@/lib/types";
import { financialConfidenceToBadge, marketingTierToBadge } from "@/lib/confidence";
import { formatMoney } from "@/lib/format";
import ConfidenceBadge from "./ConfidenceBadge";

const NEVER_REFRESHED = new Date(0).toISOString();

function trendArrow(series: { value: number }[]) {
  if (series.length < 2) return null;
  const last = series[series.length - 1].value;
  const prev = series[series.length - 2].value;
  if (last === prev) return { dir: "flat" as const, pct: 0 };
  const pct = ((last - prev) / Math.abs(prev)) * 100;
  return { dir: last > prev ? ("up" as const) : ("down" as const), pct };
}

function ArrowBadge({ series }: { series: { value: number }[] }) {
  const t = trendArrow(series);
  if (!t) return <span className="text-xs text-muted">no trend yet</span>;
  const color = t.dir === "up" ? "text-positive" : t.dir === "down" ? "text-negative" : "text-muted";
  const glyph = t.dir === "up" ? "▲" : t.dir === "down" ? "▼" : "—";
  return (
    <span className={`text-xs font-medium ${color}`}>
      {glyph} {Math.abs(t.pct).toFixed(1)}%
    </span>
  );
}

function DerivationPanel({ title, derivation }: { title: string; derivation: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3 border-t border-border pt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-medium text-accent hover:underline"
      >
        {open ? "Hide" : "How we got this number"} {open ? "▲" : "▼"}
      </button>
      {open && (
        <p className="mt-2 text-xs leading-relaxed text-muted">
          <span className="sr-only">{title}: </span>
          {derivation}
        </p>
      )}
    </div>
  );
}

function MetricTile({
  label,
  value,
  badge,
  trend,
  derivation,
  derivationTitle,
}: {
  label: string;
  value: string;
  badge: React.ReactNode;
  trend?: React.ReactNode;
  derivation?: string;
  derivationTitle?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
        {badge}
      </div>
      <div className="mt-2 text-2xl font-semibold text-foreground">{value}</div>
      <div className="mt-1">{trend}</div>
      {derivation && derivationTitle && (
        <DerivationPanel title={derivationTitle} derivation={derivation} />
      )}
    </div>
  );
}

function Sparkline({
  data,
  dataKey,
  xKey,
  currency,
}: {
  data: { value: number }[];
  dataKey: string;
  xKey: string;
  currency: string;
}) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-xs text-muted">
        No historical data yet — this chart will build up as daily refreshes run.
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: "var(--muted)" }} minTickGap={20} />
        <YAxis
          tick={{ fontSize: 10, fill: "var(--muted)" }}
          tickFormatter={(v: number) => formatMoney(v, currency)}
          width={72}
          domain={["auto", "auto"]}
        />
        <Tooltip
          formatter={(v) => [formatMoney(typeof v === "number" ? v : Number(v), currency), "Value"]}
          contentStyle={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Line type="monotone" dataKey={dataKey} stroke="var(--accent)" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default function BrandProfile({ brand }: { brand: BrandData }) {
  const stockSeries = brand.trend_history?.stock ?? [];
  const revenueSeries = brand.trend_history?.revenue ?? [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {brand.live_search && (
        <div className="mb-6 rounded-lg border border-warning/50 bg-warning/10 px-4 py-2 text-xs text-foreground">
          This is a live, one-off lookup for &quot;{brand.name}&quot; — it is not part of the
          tracked portfolio and was not saved.
        </div>
      )}

      {/* Header band */}
      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white">
                {brand.name.slice(0, 1).toUpperCase()}
              </div>
              <h1 className="text-2xl font-semibold">{brand.name}</h1>
            </div>
            <p className="mt-2 max-w-2xl text-sm text-muted">{brand.description}</p>
            {brand.parent && (
              <p className="mt-1 text-sm text-foreground">
                <span className="text-muted">Part of </span>
                <span className="font-medium">{brand.parent}</span>
              </p>
            )}
          </div>
          <span className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted">
            {brand.category}
          </span>
        </div>
        <p className="mt-4 text-xs text-muted">
          Last refreshed:{" "}
          {brand.last_refreshed && brand.last_refreshed !== NEVER_REFRESHED
            ? new Date(brand.last_refreshed).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) + " IST"
            : "Awaiting first refresh"}
        </p>
      </div>

      {/* Metric strip */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          label="Stock price"
          value={
            brand.stock.applicable
              ? formatMoney(brand.stock.value, brand.stock.currency)
              : brand.entity_type === "public_parent"
                ? "Not separately listed"
                : "Private"
          }
          badge={
            <ConfidenceBadge
              level={brand.stock.applicable ? "disclosed" : "not_applicable"}
            />
          }
          trend={<ArrowBadge series={stockSeries} />}
        />
        <MetricTile
          label={`Revenue (${brand.revenue.period || "—"})`}
          value={formatMoney(brand.revenue.value, brand.revenue.currency)}
          badge={<ConfidenceBadge level={financialConfidenceToBadge(brand.revenue.confidence)} />}
          trend={<ArrowBadge series={revenueSeries} />}
        />
        <MetricTile
          label={`Operating profit (${brand.operating_profit.period || "—"})`}
          value={formatMoney(brand.operating_profit.value, brand.operating_profit.currency)}
          badge={
            <ConfidenceBadge level={financialConfidenceToBadge(brand.operating_profit.confidence)} />
          }
        />
        <MetricTile
          label={`Marketing spend (${brand.marketing_spend.period || "—"})`}
          value={`${formatMoney(brand.marketing_spend.value_low, brand.marketing_spend.currency)} – ${formatMoney(brand.marketing_spend.value_high, brand.marketing_spend.currency)}`}
          badge={<ConfidenceBadge level={marketingTierToBadge(brand.marketing_spend.tier)} />}
          derivation={brand.marketing_spend.derivation}
          derivationTitle="Marketing spend"
        />
      </div>

      {/* Trend charts */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold">Stock price trend</h2>
          <div className="mt-2">
            <Sparkline data={stockSeries} dataKey="value" xKey="date" currency={brand.stock.currency} />
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold">Revenue trend</h2>
          <div className="mt-2">
            <Sparkline data={revenueSeries} dataKey="value" xKey="period" currency={brand.revenue.currency} />
          </div>
        </div>
      </div>

      {/* Expenses breakdown, if any */}
      {brand.expenses?.breakdown?.length > 0 && (
        <div className="mt-6 rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Expense breakdown</h2>
            <ConfidenceBadge level={financialConfidenceToBadge(brand.expenses.confidence)} />
          </div>
          <ul className="mt-3 divide-y divide-border">
            {brand.expenses.breakdown.map((line, i) => (
              <li key={i} className="flex items-center justify-between py-2 text-sm">
                <span>{line.label}</span>
                <span className="flex items-center gap-2">
                  {formatMoney(line.value, brand.revenue.currency)}
                  <ConfidenceBadge level={line.confidence === "disclosed" ? "disclosed" : "modeled"} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Business updates */}
      <div className="mt-6 rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold">Recent business updates</h2>
        {brand.business_updates?.length ? (
          <ul className="mt-3 space-y-3">
            {brand.business_updates.map((u, i) => (
              <li key={i} className="text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">{u.headline}</span>
                  <span className="shrink-0 text-xs text-muted">{u.date}</span>
                </div>
                {u.source.url ? (
                  <a
                    href={u.source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-accent hover:underline"
                  >
                    {u.source.name}
                    {u.source.date ? ` · ${u.source.date}` : ""}
                  </a>
                ) : (
                  <span className="text-xs text-muted">
                    {u.source.name}
                    {u.source.date ? ` · ${u.source.date}` : ""}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">No recent updates found yet.</p>
        )}
      </div>
    </div>
  );
}
