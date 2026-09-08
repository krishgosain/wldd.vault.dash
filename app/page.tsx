import { ArrowRight } from "lucide-react";
import { listAllBrands, latestRefreshTimestamp } from "@/lib/data";
import PortfolioGrid from "@/components/PortfolioGrid";

export const revalidate = 3600;

export default function Home() {
  const brands = listAllBrands();
  const lastRefreshed = latestRefreshTimestamp(brands);

  return (
    <div>
      <section className="relative flex flex-col items-center px-6 pb-16 pt-16 text-center md:pt-24">
        <div className="pill mb-8">
          <span>{brands.length} brands tracked, refreshed daily</span>
          <a href="#portfolio" className="flex items-center gap-1 hover:text-foreground transition-colors">
            View portfolio
            <ArrowRight size={12} />
          </a>
        </div>

        <h1
          className="max-w-3xl px-6 text-4xl font-medium leading-tight md:text-5xl lg:text-6xl"
          style={{
            background:
              "linear-gradient(to bottom, var(--foreground), var(--foreground), color-mix(in srgb, var(--foreground) 60%, transparent))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            letterSpacing: "-0.03em",
          }}
        >
          Know what&apos;s really happening <br />behind the brand
        </h1>

        <p className="mt-6 max-w-2xl px-6 text-sm text-muted md:text-base">
          Revenue, stock price, and marketing spend for a curated portfolio of brands — every
          figure tagged Disclosed, Industry-benchmark, Modeled, or Triangulated. <br />
          Can&apos;t find a brand? Search for it above and we&apos;ll pull it live.
        </p>

        <div className="relative z-10 mt-10 flex items-center gap-4">
          <a
            href="#portfolio"
            className="btn-gradient inline-flex h-12 items-center justify-center rounded-lg px-8 text-base font-medium"
          >
            Explore the portfolio
          </a>
        </div>
      </section>

      <section id="portfolio" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-16 sm:px-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold">Portfolio</h2>
          <p className="text-xs text-muted">
            Last refreshed:{" "}
            {lastRefreshed
              ? new Date(lastRefreshed).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) + " IST"
              : "—"}
          </p>
        </div>
        <div className="mt-6">
          <PortfolioGrid brands={brands} />
        </div>
      </section>
    </div>
  );
}
