/**
 * Core domain types for the hardware price scanner.
 *
 * The scanner pulls current market listings from multiple retailers across
 * regions, normalizes them into {@link PriceListing} rows, and caches the
 * aggregate snapshot as {@link PriceSnapshot}.
 *
 * Every type that crosses a trust boundary (cache file, export) has a paired
 * Effect {@link Schema} definition so we can validate unknown JSON at runtime
 * instead of blindly casting with `as`.
 */
import { Schema } from "../lib/effect.js";

/** Top-level hardware categories the scanner tracks. */
export type HardwareCategory = "gpu" | "apple" | "amd" | "memory";

/** Whether a listing is brand-new, refurbished, or second-hand used. */
export type Condition = "new" | "refurbished" | "used";

/**
 * A geographic market. Prices vary by country, currency, and retailer
 * availability, so every listing is tagged with the region it was sourced from.
 */
export interface Region {
  /** ISO 3166-1 alpha-2 country code, e.g. "US", "DE", "GB". */
  code: string;
  /** Human-readable country name. */
  name: string;
  /** ISO 4217 currency code the price is listed in, e.g. "USD", "EUR". */
  currency: string;
}

// ── Effect Schema definitions (runtime validation at data boundaries) ──

export const RegionSchema = Schema.Struct({
  code: Schema.String,
  name: Schema.String,
  currency: Schema.String,
});

export const HardwareCategorySchema = Schema.Literals(["gpu", "apple", "amd", "memory"]);

export const ConditionSchema = Schema.Literals(["new", "refurbished", "used"]);

/**
 * A normalized price listing for a single product from a single retailer.
 *
 * One product (e.g. "RTX 4090") can have many listings — one per retailer per
 * region per condition. The scanner collects all of them so the CLI/site can
 * show availability, price spread, and averages.
 */
export interface PriceListing {
  /** Stable product slug, matching {@link Product.id}. */
  productId: string;
  /** Human-readable product name. */
  productName: string;
  /** Category the product belongs to. */
  category: HardwareCategory;
  /** Retailer/source identifier, e.g. "microcenter", "apple-store", "newegg". */
  retailer: string;
  /** Region the listing was sourced from. */
  region: Region;
  /** Condition of the item. */
  condition: Condition;
  /** Listed price in the region's currency, as a raw number (e.g. 1599.99). */
  price: number;
  /** Display currency code (mirrors {@link Region.currency}). */
  currency: string;
  /** Direct URL to the retailer's product/search page. */
  url: string;
  /** Whether the listing was reported as in stock. */
  inStock: boolean | null;
  /** Units available at this retailer, if reported. `null` when unknown. */
  quantity: number | null;
  /** ISO-8601 timestamp the listing was fetched. */
  fetchedAt: string;
}

export const PriceListingSchema = Schema.Struct({
  productId: Schema.String,
  productName: Schema.String,
  category: HardwareCategorySchema,
  retailer: Schema.String,
  region: RegionSchema,
  condition: ConditionSchema,
  price: Schema.Number,
  currency: Schema.String,
  url: Schema.String,
  inStock: Schema.NullOr(Schema.Boolean),
  quantity: Schema.NullOr(Schema.Number),
  fetchedAt: Schema.String,
});

/**
 * Per-product aggregate statistics computed from a set of listings.
 * Separated so the cache can store raw listings and recompute aggregates
 * cheaply without re-fetching.
 */
export interface ProductPriceSummary {
  productId: string;
  /** Listings that fed into this summary. */
  listingCount: number;
  /** Currency the headline stats (low/avg/median) are reported in. Stats are
   * computed per-currency, so this tells the UI which symbol to show. */
  currency: string;
  /** Lowest new price found, in the summary currency. `null` if none. */
  lowestNew: number | null;
  /** Highest new price found. */
  highestNew: number | null;
  /** Arithmetic mean of new prices. */
  averageNew: number | null;
  /** Median of new prices — more robust to outlier markups. */
  medianNew: number | null;
  /** Lowest refurbished price, if any refurbished listings exist. */
  lowestRefurbished: number | null;
  /** Lowest used price, if any used listings exist. */
  lowestUsed: number | null;
  /** Number of distinct retailers with at least one listing. */
  retailerCount: number;
  /** Number of distinct regions covered. */
  regionCount: number;
  /** Number of listings marked in stock. */
  inStockCount: number;
}

export const ProductPriceSummarySchema = Schema.Struct({
  productId: Schema.String,
  listingCount: Schema.Number,
  currency: Schema.String,
  lowestNew: Schema.NullOr(Schema.Number),
  highestNew: Schema.NullOr(Schema.Number),
  averageNew: Schema.NullOr(Schema.Number),
  medianNew: Schema.NullOr(Schema.Number),
  lowestRefurbished: Schema.NullOr(Schema.Number),
  lowestUsed: Schema.NullOr(Schema.Number),
  retailerCount: Schema.Number,
  regionCount: Schema.Number,
  inStockCount: Schema.Number,
});

/** Records a source that failed during a scan, so the UI can show gaps. */
export interface SourceError {
  retailer: string;
  region: string;
  /** Short human-readable reason, e.g. "HTTP 403" or "no results parsed". */
  message: string;
}

export const SourceErrorSchema = Schema.Struct({
  retailer: Schema.String,
  region: Schema.String,
  message: Schema.String,
});

/**
 * A cached snapshot of the whole market at a point in time.
 * This is the single artifact the CLI writes and the website reads.
 */
export interface PriceSnapshot {
  /** ISO-8601 timestamp the snapshot was generated. */
  generatedAt: string;
  /** All raw listings collected in this scan. */
  listings: PriceListing[];
  /** Aggregate summaries keyed by product id. */
  summaries: Record<string, ProductPriceSummary>;
  /** Which sources reported errors during the scan. */
  errors: SourceError[];
}

export const PriceSnapshotSchema = Schema.Struct({
  generatedAt: Schema.String,
  listings: Schema.Array(PriceListingSchema),
  summaries: Schema.Record(Schema.String, ProductPriceSummarySchema),
  errors: Schema.Array(SourceErrorSchema),
});

/**
 * A product the scanner knows how to look up. Defined once in the catalog
 * (see products.ts) and matched against retailer results.
 */
export interface Product {
  /** Stable slug, e.g. "rtx-4090". */
  id: string;
  /** Display name. */
  name: string;
  /** Category. */
  category: HardwareCategory;
  /** Search query strings per retailer family. Different retailers index
   * products differently, so we allow per-source query overrides. */
  queries: Partial<Record<string, string>>;
  /** Canonical manufacturer, for display. */
  manufacturer: string;
  /** Minimum price in USD below which a listing is almost certainly an
   * accessory (water block, bracket, cable) rather than the actual product.
   * Used by Amazon/Newegg to filter false positives. 0 means no floor. */
  minPriceUsd?: number;
}
