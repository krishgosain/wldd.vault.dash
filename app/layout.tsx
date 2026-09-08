import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import ThemeToggle from "@/components/ThemeToggle";
import SearchBar from "@/components/SearchBar";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
    <html lang="en" className={`${poppins.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <header className="fixed top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
            <Link href="/" className="shrink-0 text-lg font-semibold tracking-tight">
              Rev Tracker
            </Link>
            <div className="order-3 w-full sm:order-2 sm:max-w-md sm:flex-1">
              <SearchBar />
            </div>
            <div className="order-2 ml-auto sm:order-3">
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main className="flex-1 pt-[64px]">{children}</main>
        <footer className="border-t border-border px-4 py-6 text-center text-xs text-muted">
          Every figure carries a confidence label — Disclosed, Industry-benchmark, Modeled, or
          Triangulated. Nothing here is investment advice.
        </footer>
      </body>
    </html>
  );
}
