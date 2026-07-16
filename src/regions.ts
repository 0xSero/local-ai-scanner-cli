/**
 * Regions the scanner covers. Prices vary by country (availability, taxes,
 * currency), so each listing is tagged with one of these.
 *
 * Each region lists the source ids active in it. A single source module (e.g.
 * `apple-store`) handles multiple regions internally — it appears in every
 * region it covers.
 *
 * Every region has at least 5 distinct suppliers so the stats reflect a real
 * market spread rather than a single retailer's pricing.
 */
import type { Region } from "./types.js";

export interface RegionSpec extends Region {
  /** Retailer source ids active in this region, e.g. ["newegg", "amazon"]. */
  sources: string[];
}

/**
 * The markets we scan. US retailers are USD; European retailers list in their
 * local currency. The CLI does not convert currencies — each listing keeps its
 * native currency so the table reflects what's actually charged.
 */
export const REGIONS: RegionSpec[] = [
  {
    code: "US",
    name: "United States",
    currency: "USD",
    sources: ["newegg", "amazon", "ebay", "microcenter", "apple-store", "apple-refurbished", "minisforum", "gmktec", "crucial"],
  },
  {
    code: "DE",
    name: "Germany",
    currency: "EUR",
    sources: ["alternate", "amazon", "ebay", "apple-store", "apple-refurbished", "crucial"],
  },
  {
    code: "GB",
    name: "United Kingdom",
    currency: "GBP",
    sources: ["amazon", "ebay", "apple-store", "apple-refurbished", "crucial", "awd-it"],
  },
  {
    code: "JP",
    name: "Japan",
    currency: "JPY",
    sources: ["amazon", "apple-store", "apple-refurbished", "yodobashi", "dospara", "crucial"],
  },
  {
    code: "PL",
    name: "Poland",
    currency: "PLN",
    sources: ["allegro", "amazon", "ebay", "apple-store", "apple-refurbished", "crucial", "ceneo"],
  },
];

/** Look up a region spec by its country code. */
export function getRegion(code: string): RegionSpec | undefined {
  return REGIONS.find((r) => r.code === code);
}

/** A bare {@link Region} (no sources) for embedding in listings. */
export function regionOf(code: string): Region {
  const r = getRegion(code);
  if (!r) throw new Error(`Unknown region code: ${code}`);
  return { code: r.code, name: r.name, currency: r.currency };
}
