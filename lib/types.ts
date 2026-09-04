// Shared types for the Rev Tracker / Finance Dash data model.
// See BUILD BRIEF Section 5 for the canonical schema this mirrors.

export type EntityType =
  | "public_standalone"
  | "public_parent"
  | "india_private_registered"
  | "foreign_private";

export type MarketingTier =
  | "1_disclosed"
  | "2_industry_benchmark"
  | "3_modeled"
  | "4_triangulated";

export type FinancialConfidence = "disclosed" | "press_estimate" | "not_found";
export type StockConfidence = "disclosed" | "not_applicable";

export interface SourceRef {
  name: string;
  url: string;
  date: string; // ISO date
}

export interface StockField {
  applicable: boolean;
  value: number | null;
  currency: string;
  ticker: string | null;
  as_of: string | null;
  note: string;
  confidence: StockConfidence;
}

export interface FinancialField {
  value: number | null;
  currency: string;
  period: string;
  confidence: FinancialConfidence;
  source: SourceRef | null;
}

export interface ExpenseLine {
  label: string;
  value: number;
  confidence: "disclosed" | "modeled";
}

export interface ExpensesField {
  breakdown: ExpenseLine[];
  confidence: FinancialConfidence;
}

export interface MarketingSpendField {
  value_low: number;
  value_high: number;
  currency: string;
  period: string;
  tier: MarketingTier;
  derivation: string;
  source: SourceRef | null;
}

export interface TrendPoint {
  date?: string;
  period?: string;
  value: number;
}

export interface TrendHistory {
  stock: TrendPoint[];
  revenue: TrendPoint[];
}

export interface BusinessUpdate {
  headline: string;
  date: string;
  source: SourceRef;
}

export interface BrandData {
  name: string;
  slug: string;
  parent: string | null;
  entity_type: EntityType;
  category: string;
  description: string;
  last_refreshed: string;
  stock: StockField;
  revenue: FinancialField;
  operating_profit: FinancialField;
  expenses: ExpensesField;
  marketing_spend: MarketingSpendField;
  trend_history: TrendHistory;
  business_updates: BusinessUpdate[];
  live_search?: boolean; // true for one-off, never-persisted live lookups
}

// Config-only entry (Section 4 seed list). Adding a brand = one entry here.
export interface BrandConfigEntry {
  name: string;
  parent: string | null;
  entity_type: EntityType;
  category: string;
  ticker?: string;
  parent_ticker?: string;
  cin?: string;
  note?: string;
}
