/**
 * Aggregate statistics computed from raw {@link PriceListing} rows.
 *
 * Kept separate from fetching so we can recompute summaries from cached
 * listings without re-hitting retailers. We compute low/high/mean/median for
 * NEW listings (the headline number), plus the floor price for refurbished
 * and used where available.
 */
import type { PriceListing, ProductPriceSummary } from "./types.js";

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function minOrNull(values: number[]): number | null {
  return values.length === 0 ? null : Math.min(...values);
}

/**
 * Build a per-product summary from its listings.
 *
 * Stats are computed per-currency (you can't average $5,299 and ¥899,800
 * meaningfully). We pick the currency with the most listings as the "primary"
 * currency and report stats in that. Retailer/region/stock counts span all
 * currencies.
 *
 * @param productId - the product these listings belong to
 * @param listings - only listings matching `productId` should be passed
 */
export function summarize(productId: string, listings: PriceListing[]): ProductPriceSummary {
  // Group by currency so we don't mix USD + JPY + EUR in one average
  const byCurrency = new Map<string, PriceListing[]>();
  for (const l of listings) {
    const arr = byCurrency.get(l.currency) ?? [];
    arr.push(l);
    byCurrency.set(l.currency, arr);
  }
  // Primary currency = the one with the most NEW listings. USD is preferred
  // on ties so headline stats read in dollars. Only switch to another currency
  // when it strictly has MORE new listings than USD (e.g. RTX 5090 with 8 new
  // EUR listings vs 0 new USD). When no currency has new listings, USD is kept
  // as long as it has any listings at all.
  let primaryCurrency = "USD";
  let primaryListings: PriceListing[] = byCurrency.get("USD") ?? [];
  let primaryNewCount = primaryListings.filter((l) => l.condition === "new").length;
  for (const [cur, group] of byCurrency) {
    const newCount = group.filter((l) => l.condition === "new").length;
    if (newCount > primaryNewCount) {
      primaryCurrency = cur;
      primaryListings = group;
      primaryNewCount = newCount;
    }
  }
  // Edge case: USD has zero listings at all (product not sold in US). Fall back
  // to the currency with the most total listings.
  if (primaryListings.length === 0) {
    for (const [cur, group] of byCurrency) {
      if (group.length > primaryListings.length) {
        primaryCurrency = cur;
        primaryListings = group;
      }
    }
  }

  const newPrices = primaryListings.filter((l) => l.condition === "new").map((l) => l.price);
  const refurbPrices = primaryListings.filter((l) => l.condition === "refurbished").map((l) => l.price);
  const usedPrices = primaryListings.filter((l) => l.condition === "used").map((l) => l.price);

  const retailers = new Set(listings.map((l) => l.retailer));
  const regions = new Set(listings.map((l) => l.region.code));
  const inStock = listings.filter((l) => l.inStock === true).length;

  return {
    productId,
    listingCount: listings.length,
    currency: primaryCurrency,
    lowestNew: minOrNull(newPrices),
    highestNew: newPrices.length ? Math.max(...newPrices) : null,
    averageNew: newPrices.length ? newPrices.reduce((s, p) => s + p, 0) / newPrices.length : null,
    medianNew: newPrices.length ? median(newPrices) : null,
    lowestRefurbished: minOrNull(refurbPrices),
    lowestUsed: minOrNull(usedPrices),
    retailerCount: retailers.size,
    regionCount: regions.size,
    inStockCount: inStock,
  };
}

/**
 * Build summaries for every product represented in `listings`.
 * Returns a record keyed by product id.
 */
export function summarizeAll(listings: PriceListing[]): Record<string, ProductPriceSummary> {
  const byProduct = new Map<string, PriceListing[]>();
  for (const l of listings) {
    const arr = byProduct.get(l.productId) ?? [];
    arr.push(l);
    byProduct.set(l.productId, arr);
  }
  const out: Record<string, ProductPriceSummary> = {};
  for (const [id, group] of byProduct) {
    out[id] = summarize(id, group);
  }
  return out;
}
