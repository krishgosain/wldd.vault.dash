"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SearchBar({ className = "" }: { className?: string }) {
  const [value, setValue] = useState("");
  const router = useRouter();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    if (!q) return;
    router.push(`/brand/lookup?name=${encodeURIComponent(q)}`);
  }

  return (
    <form onSubmit={onSubmit} className={`w-full ${className}`} role="search">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        type="text"
        placeholder="Search any brand..."
        aria-label="Search any brand"
        className="w-full rounded-full border border-border bg-surface px-5 py-2.5 text-sm text-foreground outline-none placeholder:text-muted focus:border-accent"
      />
    </form>
  );
}
