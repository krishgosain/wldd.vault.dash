"use client";

import { useEffect, useState } from "react";
import type { BrandData } from "@/lib/types";
import BrandProfile from "./BrandProfile";

type State =
  | { status: "loading" }
  | { status: "capacity"; message: string }
  | { status: "error"; message: string }
  | { status: "done"; brand: BrandData };

export default function LiveSearchProfile({ name }: { name: string }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/search-brand?name=${encodeURIComponent(name)}`)
      .then(async (res) => {
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          // 503 = we're deliberately declining the call (rate limit, or the
          // shared Tavily/Gemini free-tier quota is exhausted) — a graceful,
          // expected state, not a failure.
          if (res.status === 503 || res.status === 429) {
            setState({ status: "capacity", message: body.error ?? "Live search is temporarily at capacity — try again later." });
          } else {
            setState({ status: "error", message: body.error ?? "Something went wrong." });
          }
          return;
        }
        setState({ status: "done", brand: body.brand as BrandData });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", message: "Network error — please try again." });
      });
    return () => {
      cancelled = true;
    };
  }, [name]);

  if (state.status === "loading") {
    return (
      <div className="mx-auto flex max-w-5xl flex-col items-center px-4 py-24 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
        <p className="mt-4 text-sm text-muted">Pulling latest filings for {name}...</p>
        <p className="mt-1 text-xs text-muted">This can take several seconds — we&apos;re running a live search.</p>
      </div>
    );
  }

  if (state.status === "capacity") {
    return (
      <div className="mx-auto max-w-5xl px-4 py-24 text-center">
        <div className="mx-auto max-w-sm rounded-xl border border-warning/50 bg-warning/10 px-5 py-4">
          <p className="text-sm font-medium text-foreground">{state.message}</p>
          <p className="mt-1 text-xs text-muted">
            Live search shares a limited daily/monthly free-tier quota across all visitors — it
            resets automatically.
          </p>
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="mx-auto max-w-5xl px-4 py-24 text-center">
        <p className="text-sm text-negative">{state.message}</p>
      </div>
    );
  }

  return <BrandProfile brand={state.brand} />;
}
