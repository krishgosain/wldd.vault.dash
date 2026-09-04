// Confidence badge config shared across financial fields (Section 8).
// Color + icon together, never color alone.

export type BadgeLevel = "disclosed" | "industry_benchmark" | "modeled" | "triangulated" | "not_found" | "not_applicable";

export const BADGE: Record<BadgeLevel, { label: string; icon: string; className: string }> = {
  disclosed: { label: "Disclosed", icon: "●", className: "badge-disclosed" }, // green filled circle
  industry_benchmark: { label: "Industry benchmark", icon: "◆", className: "badge-benchmark" }, // blue diamond
  modeled: { label: "Modeled", icon: "▲", className: "badge-modeled" }, // yellow triangle
  triangulated: { label: "Triangulated", icon: "■", className: "badge-triangulated" }, // orange square
  not_found: { label: "Not found", icon: "–", className: "badge-not-found" }, // dash
  not_applicable: { label: "N/A", icon: "–", className: "badge-not-found" },
};

export function financialConfidenceToBadge(c: "disclosed" | "press_estimate" | "not_found"): BadgeLevel {
  if (c === "disclosed") return "disclosed";
  if (c === "press_estimate") return "modeled";
  return "not_found";
}

export function marketingTierToBadge(tier: "1_disclosed" | "2_industry_benchmark" | "3_modeled" | "4_triangulated"): BadgeLevel {
  switch (tier) {
    case "1_disclosed":
      return "disclosed";
    case "2_industry_benchmark":
      return "industry_benchmark";
    case "3_modeled":
      return "modeled";
    case "4_triangulated":
      return "triangulated";
  }
}
