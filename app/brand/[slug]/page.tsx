import Link from "next/link";
import { listTrackedSlugs, readBrandFile } from "@/lib/data";
import BrandProfile from "@/components/BrandProfile";

export const revalidate = 3600;

export function generateStaticParams() {
  return listTrackedSlugs().map((slug) => ({ slug }));
}

export default async function BrandPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const brand = readBrandFile(slug);
  if (!brand) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 text-center">
        <p className="text-sm text-muted">
          &quot;{slug}&quot; isn&apos;t a tracked brand yet.
        </p>
        <Link href="/" className="mt-2 inline-block text-sm text-accent hover:underline">
          Back to portfolio
        </Link>
      </div>
    );
  }
  return <BrandProfile brand={brand} />;
}
