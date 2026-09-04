"use client";

import { useMemo, useState } from "react";
import type { BrandData } from "@/lib/types";
import BrandCard from "./BrandCard";

type SortMode = "name" | "most_active";
type OwnershipFilter = "all" | "public" | "private";

function isPublic(b: BrandData) {
  return b.entity_type === "public_standalone" || b.entity_type === "public_parent";
}

function activityScore(b: BrandData) {
  return b.business_updates?.length ?? 0;
}

export default function PortfolioGrid({ brands }: { brands: BrandData[] }) {
  const categories = useMemo(
    () => Array.from(new Set(brands.map((b) => b.category))).sort(),
    [brands]
  );
  const [category, setCategory] = useState<string>("all");
  const [ownership, setOwnership] = useState<OwnershipFilter>("all");
  const [sort, setSort] = useState<SortMode>("name");

  const filtered = useMemo(() => {
    let list = brands.slice();
    if (category !== "all") list = list.filter((b) => b.category === category);
    if (ownership !== "all") list = list.filter((b) => (ownership === "public" ? isPublic(b) : !isPublic(b)));
    if (sort === "most_active") list.sort((a, b) => activityScore(b) - activityScore(a));
    else list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [brands, category, ownership, sort]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-full border border-border bg-surface px-3 py-1.5"
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={ownership}
          onChange={(e) => setOwnership(e.target.value as OwnershipFilter)}
          className="rounded-full border border-border bg-surface px-3 py-1.5"
        >
          <option value="all">Public + Private</option>
          <option value="public">Public only</option>
          <option value="private">Private only</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortMode)}
          className="rounded-full border border-border bg-surface px-3 py-1.5"
        >
          <option value="name">Sort: A–Z</option>
          <option value="most_active">Sort: Most active today</option>
        </select>
        <span className="ml-auto text-muted">{filtered.length} brands</span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((b) => (
          <BrandCard key={b.slug} brand={b} />
        ))}
      </div>
    </div>
  );
}
