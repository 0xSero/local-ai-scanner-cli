/**
 * Regions the scanner covers. Prices vary by country (availability, taxes,
 * currency), so each listing is tagged with one of these.
 *
 * Each region lists the source ids active in it. A single source module (e.g.
 * `apple-store`) handles multiple regions internally — it appears in every
 * region it covers.
 *
 * Supplier depth is uneven. The five original markets (US/DE/GB/JP/PL) each
 * have >=5 distinct suppliers. The markets added later are covered only by the
 * vendor-official stores that publish prices over plain HTTP (Apple, Lenovo,
 * Dell); they have fewer than five suppliers and are flagged `partial: true`
 * with a comment naming the gap. A region is only listed here when a
 * vendor-official store was live-verified to publish a real price for it.
 */
import type { Region } from "./types.js";

export interface RegionSpec extends Region {
  /** Retailer source ids active in this region, e.g. ["newegg", "amazon"]. */
  sources: string[];
  /**
   * True when this region has fewer than five distinct suppliers. Such regions
   * are covered only by vendor-official stores; the trailing comment names
   * which supplier families are missing.
   */
  partial?: boolean;
}

/**
 * The markets we scan. The CLI does not convert currencies — each listing
 * keeps its native currency (read from the source page) so the table reflects
 * what's actually charged in that market.
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
    sources: ["alternate", "amazon", "ebay", "apple-store", "apple-refurbished", "crucial", "lenovo"],
  },
  {
    code: "GB",
    name: "United Kingdom",
    currency: "GBP",
    sources: ["amazon", "ebay", "apple-store", "apple-refurbished", "crucial", "awd-it", "lenovo"],
  },
  {
    code: "JP",
    name: "Japan",
    currency: "JPY",
    sources: ["amazon", "apple-store", "apple-refurbished", "yodobashi", "dospara", "crucial", "lenovo"],
  },
  {
    code: "PL",
    name: "Poland",
    currency: "PLN",
    sources: ["allegro", "amazon", "ebay", "apple-store", "apple-refurbished", "crucial", "ceneo", "morele"],
  },

  // ── Vendor-store-only markets (added 2026-09; each < 5 suppliers) ─────────
  // Covered solely by Apple/Lenovo/Dell official stores verified over plain
  // HTTP. No local marketplace or multi-retailer coverage exists yet, so every
  // region below is `partial`. The comment on each names the vendor families
  // that do NOT serve it (on top of the absent marketplace/retail coverage).
  { code: "FR", name: "France", currency: "EUR", sources: ["apple-store", "apple-refurbished", "lenovo"], partial: true }, // no dell-store; no marketplace/retail
  { code: "ES", name: "Spain", currency: "EUR", sources: ["apple-store", "apple-refurbished", "lenovo"], partial: true }, // no dell-store; no marketplace/retail
  { code: "IT", name: "Italy", currency: "EUR", sources: ["apple-store", "apple-refurbished", "lenovo"], partial: true }, // no dell-store; no marketplace/retail
  { code: "NL", name: "Netherlands", currency: "EUR", sources: ["apple-store", "apple-refurbished", "lenovo"], partial: true }, // no dell-store; no marketplace/retail
  { code: "SE", name: "Sweden", currency: "SEK", sources: ["apple-store", "lenovo", "dell-store"], partial: true }, // no apple-refurbished; no marketplace/retail
  { code: "AU", name: "Australia", currency: "AUD", sources: ["apple-store", "apple-refurbished", "lenovo", "dell-store"], partial: true }, // no marketplace/retail
  { code: "CA", name: "Canada", currency: "CAD", sources: ["apple-store", "apple-refurbished", "lenovo", "dell-store"], partial: true }, // no marketplace/retail
  { code: "IN", name: "India", currency: "INR", sources: ["apple-store", "lenovo"], partial: true }, // no apple-refurbished, no dell-store; no marketplace/retail
  { code: "BR", name: "Brazil", currency: "BRL", sources: ["apple-store", "lenovo", "dell-store"], partial: true }, // no apple-refurbished; no marketplace/retail
  { code: "MX", name: "Mexico", currency: "MXN", sources: ["apple-store", "lenovo"], partial: true }, // no apple-refurbished, no dell-store; no marketplace/retail
  { code: "AE", name: "United Arab Emirates", currency: "AED", sources: ["apple-store"], partial: true }, // no apple-refurbished, no lenovo, no dell-store; no marketplace/retail
  { code: "SG", name: "Singapore", currency: "SGD", sources: ["apple-store", "apple-refurbished", "lenovo", "dell-store"], partial: true }, // no marketplace/retail
  { code: "KR", name: "South Korea", currency: "KRW", sources: ["apple-store", "apple-refurbished", "lenovo"], partial: true }, // no dell-store; no marketplace/retail
  { code: "TW", name: "Taiwan", currency: "TWD", sources: ["apple-store", "apple-refurbished", "lenovo"], partial: true }, // no dell-store; no marketplace/retail
  { code: "CH", name: "Switzerland", currency: "CHF", sources: ["apple-store", "lenovo", "dell-store"], partial: true }, // no apple-refurbished; no marketplace/retail
  { code: "AT", name: "Austria", currency: "EUR", sources: ["apple-store", "apple-refurbished", "lenovo"], partial: true }, // no dell-store; no marketplace/retail
  { code: "BE", name: "Belgium", currency: "EUR", sources: ["apple-store", "lenovo"], partial: true }, // no apple-refurbished, no dell-store; no marketplace/retail
  { code: "DK", name: "Denmark", currency: "DKK", sources: ["apple-store", "lenovo", "dell-store"], partial: true }, // no apple-refurbished; no marketplace/retail
  { code: "FI", name: "Finland", currency: "EUR", sources: ["apple-store", "lenovo"], partial: true }, // no apple-refurbished, no dell-store; no marketplace/retail
  { code: "NO", name: "Norway", currency: "NOK", sources: ["apple-store", "lenovo"], partial: true }, // no apple-refurbished, no dell-store; no marketplace/retail
  { code: "PT", name: "Portugal", currency: "EUR", sources: ["apple-store", "lenovo"], partial: true }, // no apple-refurbished, no dell-store; no marketplace/retail
  { code: "IE", name: "Ireland", currency: "EUR", sources: ["apple-store", "apple-refurbished", "lenovo"], partial: true }, // no dell-store; no marketplace/retail
  { code: "NZ", name: "New Zealand", currency: "NZD", sources: ["apple-store", "apple-refurbished", "lenovo", "dell-store"], partial: true }, // no marketplace/retail
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
