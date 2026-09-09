// Shared money formatting. INR is always expressed in crore (Cr) — the unit
// financial press and filings actually use in India — rather than the
// billion/million/thousand notation, which reads unnaturally for INR figures
// (see AGENTS.md: this app tracks mostly India-listed/registered brands).
export function formatMoney(value: number | null | undefined, currency: string): string {
  if (value === null || value === undefined) return "—";
  if (currency === "INR") return formatINR(value);

  const abs = Math.abs(value);
  let short = value.toLocaleString("en-US");
  if (abs >= 1e9) short = `${(value / 1e9).toFixed(2)}B`;
  else if (abs >= 1e6) short = `${(value / 1e6).toFixed(1)}M`;
  else if (abs >= 1e3) short = `${(value / 1e3).toFixed(1)}K`;
  return `${currency} ${short}`;
}

function formatINR(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (abs >= 1e7) {
    const cr = abs / 1e7;
    const formatted = cr.toLocaleString("en-IN", {
      maximumFractionDigits: cr >= 100 ? 0 : 2,
    });
    return `${sign}₹${formatted} Cr`;
  }
  if (abs >= 1e5) {
    const lakh = abs / 1e5;
    return `${sign}₹${lakh.toLocaleString("en-IN", { maximumFractionDigits: 2 })} L`;
  }
  return `${sign}₹${abs.toLocaleString("en-IN")}`;
}
