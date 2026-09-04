import { listAllBrands, latestRefreshTimestamp } from "@/lib/data";
import PortfolioGrid from "@/components/PortfolioGrid";

export const revalidate = 3600;

export default function Home() {
  const brands = listAllBrands();
  const lastRefreshed = latestRefreshTimestamp(brands);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold">Portfolio</h1>
        <p className="text-xs text-muted">
          Last refreshed:{" "}
          {lastRefreshed
            ? new Date(lastRefreshed).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) + " IST"
            : "—"}
        </p>
      </div>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        {brands.length} tracked brands, refreshed daily at 09:00 IST. Every number carries a
        confidence label. Can&apos;t find a brand? Search for it above — we&apos;ll pull it live.
      </p>
      <div className="mt-6">
        <PortfolioGrid brands={brands} />
      </div>
    </div>
  );
}
