"use client";

import { useEffect, useState } from "react";
import type { BrandData } from "@/lib/types";
import BrandProfile from "./BrandProfile";

type State =
  | { status: "loading" }
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
          setState({ status: "error", message: body.error ?? "Something went wrong." });
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

  if (state.status === "error") {
    return (
      <div className="mx-auto max-w-5xl px-4 py-24 text-center">
        <p className="text-sm text-negative">{state.message}</p>
      </div>
    );
  }

  return <BrandProfile brand={state.brand} />;
}
