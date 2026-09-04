import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import ThemeToggle from "@/components/ThemeToggle";
import SearchBar from "@/components/SearchBar";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rev Tracker — WLDD",
  description:
    "Financial-intelligence tracker for a curated portfolio of brands — revenue, stock, marketing spend, and confidence-tagged estimates, refreshed daily.",
};

const THEME_INIT = `
try {
  var stored = localStorage.getItem('theme');
  var dark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark', dark);
} catch (e) {}
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
            <Link href="/" className="shrink-0 text-lg font-bold tracking-tight">
              WLDD <span className="text-accent">Rev Tracker</span>
            </Link>
            <div className="order-3 w-full sm:order-2 sm:max-w-md sm:flex-1">
              <SearchBar />
            </div>
            <div className="order-2 ml-auto sm:order-3">
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-border px-4 py-6 text-center text-xs text-muted">
          Every figure carries a confidence label — Disclosed, Industry-benchmark, Modeled, or
          Triangulated. Nothing here is investment advice.
        </footer>
      </body>
    </html>
  );
}
