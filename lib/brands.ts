import type { BrandConfigEntry } from "./types";
import { slugify } from "./slug";

// The tracked-brand portfolio. Section 4 of the build brief seeds the first
// 18; the remaining ~12 below fill the ~30-brand target across public,
// India-private, and foreign-private entity types and a spread of
// categories. Adding a brand is exactly one entry here — no code change.
export const BRAND_CONFIG: BrandConfigEntry[] = [
  { name: "ChatGPT", parent: "OpenAI", entity_type: "foreign_private", category: "Consumer Tech / AI" },
  { name: "Tata Motors", parent: null, entity_type: "public_standalone", category: "Auto", ticker: "TATAMOTORS.NS" },
  { name: "Philips India", parent: "Koninklijke Philips N.V.", entity_type: "india_private_registered", category: "Consumer Electronics", cin: "U31902WB1930PLC006663", parent_ticker: "PHIA.AS" },
  { name: "Spotify", parent: null, entity_type: "public_standalone", category: "Audio Streaming", ticker: "SPOT" },
  { name: "Netflix", parent: null, entity_type: "public_standalone", category: "OTT", ticker: "NFLX" },
  { name: "Tinder", parent: "Match Group", entity_type: "public_parent", category: "Social / Dating", parent_ticker: "MTCH" },
  { name: "District", parent: "Eternal Ltd (formerly Zomato)", entity_type: "public_parent", category: "Events / Ticketing", parent_ticker: "ETERNAL.NS" },
  { name: "Audible", parent: "Amazon", entity_type: "public_parent", category: "Audio Streaming", parent_ticker: "AMZN" },
  { name: "JioHotstar", parent: "JioStar (Reliance/Disney JV)", entity_type: "india_private_registered", category: "OTT", note: "consolidated via Reliance Industries (RELIANCE.NS); Disney (DIS) equity-accounts its stake" },
  { name: "Amazon Shopping", parent: "Amazon (Amazon Seller Services Pvt Ltd)", entity_type: "public_parent", category: "E-commerce", parent_ticker: "AMZN" },
  { name: "Amazon Now", parent: "Amazon", entity_type: "public_parent", category: "Quick Commerce", parent_ticker: "AMZN" },
  { name: "Prime Video", parent: "Amazon", entity_type: "public_parent", category: "OTT", parent_ticker: "AMZN" },
  { name: "BGMI", parent: "Krafton Inc.", entity_type: "public_parent", category: "Gaming", parent_ticker: "259960.KS" },
  { name: "Paper Boat", parent: "Hector Beverages Pvt Ltd (RCPL)", entity_type: "india_private_registered", category: "F&B", note: "ownership structure unconfirmed — do not assert a majority stakeholder without a fresh MCA shareholding check" },
  { name: "Bajaj EV", parent: "Bajaj Auto Ltd", entity_type: "public_parent", category: "Auto / EV", parent_ticker: "BAJAJ-AUTO.NS" },
  { name: "Agilitas", parent: "Agilitas Sports Pvt Ltd", entity_type: "india_private_registered", category: "Footwear / Sports", cin: "U32300MH2023PTC448205" },
  { name: "Wispr Flow", parent: "Wispr AI", entity_type: "foreign_private", category: "Consumer Tech / AI" },
  { name: "Rapido", parent: "Roppen Transportation Services Pvt Ltd", entity_type: "india_private_registered", category: "Ride-hailing" },
  { name: "TCS", parent: "Tata Group", entity_type: "public_standalone", category: "IT Services", ticker: "TCS.NS" },
  { name: "Coca-Cola", parent: "The Coca-Cola Company", entity_type: "public_parent", category: "F&B", parent_ticker: "KO", note: "India operations run through Hindustan Coca-Cola Beverages Pvt Ltd (HCCB), a separately MCA-registered bottling entity — check for its own filings before assuming only global KO data is available" },

  // --- remaining ~12 to complete the ~30-brand portfolio ---
  { name: "Zepto", parent: "Kiranakart Technologies Pvt Ltd", entity_type: "india_private_registered", category: "Quick Commerce" },
  { name: "Swiggy", parent: null, entity_type: "public_standalone", category: "Food Delivery / Quick Commerce", ticker: "SWIGGY.NS" },
  { name: "PhonePe", parent: "PhonePe Pvt Ltd", entity_type: "india_private_registered", category: "Fintech", note: "majority-owned by Walmart; not separately listed" },
  { name: "Nykaa", parent: "FSN E-Commerce Ventures Ltd", entity_type: "public_standalone", category: "E-commerce / Beauty", ticker: "NYKAA.NS" },
  { name: "boAt", parent: "Imagine Marketing Ltd", entity_type: "india_private_registered", category: "Consumer Electronics" },
  { name: "Zerodha", parent: "Zerodha Broking Ltd", entity_type: "india_private_registered", category: "Fintech / Broking" },
  { name: "CRED", parent: "Dreamplug Technologies Pvt Ltd", entity_type: "india_private_registered", category: "Fintech" },
  { name: "Meesho", parent: "Fashnear Technologies Pvt Ltd", entity_type: "india_private_registered", category: "E-commerce" },
  { name: "Ola Electric", parent: null, entity_type: "public_standalone", category: "Auto / EV", ticker: "OLAELEC.NS" },
  { name: "Uber", parent: null, entity_type: "public_standalone", category: "Ride-hailing", ticker: "UBER" },
  { name: "Duolingo", parent: null, entity_type: "public_standalone", category: "EdTech", ticker: "DUOL" },
  { name: "Instagram", parent: "Meta Platforms", entity_type: "public_parent", category: "Social", parent_ticker: "META" },
];

export function brandSlug(entry: Pick<BrandConfigEntry, "name">): string {
  return slugify(entry.name);
}

export function findBrandConfig(slug: string): BrandConfigEntry | undefined {
  return BRAND_CONFIG.find((b) => brandSlug(b) === slug);
}

export const TRACKED_SLUGS = new Set(BRAND_CONFIG.map((b) => brandSlug(b)));
