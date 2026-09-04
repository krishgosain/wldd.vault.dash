import { redirect } from "next/navigation";
import { findBrandConfig, brandSlug } from "@/lib/brands";
import LiveSearchProfile from "@/components/LiveSearchProfile";

export default async function LookupPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string }>;
}) {
  const { name } = await searchParams;
  const query = (name ?? "").trim();

  if (!query) {
    redirect("/");
  }

  // If the typed name resolves to a tracked brand, go straight to its page
  // instead of paying for a live API call.
  const tracked = findBrandConfig(
    query
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
  );
  if (tracked) {
    redirect(`/brand/${brandSlug(tracked)}`);
  }

  return <LiveSearchProfile name={query} />;
}
