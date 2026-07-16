/**
 * Scan orchestrator — runs the registered sources for the requested regions
 * and products, then assembles a {@link PriceSnapshot} with raw listings and
 * per-product aggregate summaries.
 *
 * Sources run concurrently per region (they hit different hosts), but within
 * a source the products are fetched sequentially to be polite to each
 * retailer. Failed sources are recorded in the snapshot rather than aborting
 * the whole scan, so a partial result is always available.
 */
import type { HardwareCategory, PriceListing, PriceSnapshot, SourceError } from "./types.js";
import { PRODUCTS, productsByCategory } from "./products.js";
import { REGIONS } from "./regions.js";
import { sourcesForRegion } from "./source.js";
import { summarizeAll } from "./stats.js";
import { writeSnapshot } from "./cache.js";

export interface ScanOptions {
  /** Restrict to these categories. Empty/undefined = all. */
  categories?: HardwareCategory[];
  /** Restrict to these region codes. Empty/undefined = all. */
  regions?: string[];
}

/** Run a full scan and persist the snapshot. Returns the written snapshot. */
export async function runScan(options: ScanOptions = {}): Promise<PriceSnapshot> {
  const cats = options.categories?.length ? options.categories : (["gpu", "apple", "amd", "memory"] as HardwareCategory[]);
  const regionCodes = options.regions?.length ? options.regions : REGIONS.map((r) => r.code);

  const products = cats.flatMap((c) => productsByCategory(c));
  if (products.length === 0) {
    throw new Error(`No products matched categories: ${cats.join(", ")}`);
  }

  const allListings: PriceListing[] = [];
  const allErrors: SourceError[] = [];

  // Run regions in parallel; within each region, sources run in parallel too.
  const regionJobs = regionCodes.map(async (code) => {
    const region = REGIONS.find((r) => r.code === code);
    if (!region) return;
    const sources = sourcesForRegion(code).filter((s) => s.categories.some((c) => cats.includes(c)));
    if (sources.length === 0) return;

    const sourceJobs = sources.map(async (source) => {
      const relevant = products.filter((p) => source.categories.includes(p.category));
      if (relevant.length === 0) return;
      try {
        const result = await source.scan(relevant, { regionCode: code });
        allListings.push(...result.listings);
        allErrors.push(...result.errors);
      } catch (err) {
        allErrors.push({ retailer: source.id, region: code, message: `source crashed: ${String(err)}` });
      }
    });
    await Promise.all(sourceJobs);
  });

  await Promise.all(regionJobs);

  const snapshot: PriceSnapshot = {
    generatedAt: new Date().toISOString(),
    listings: allListings,
    summaries: summarizeAll(allListings),
    errors: allErrors,
  };

  await writeSnapshot(snapshot);
  return snapshot;
}

/** Convenience: scan a single product id across all regions/sources. */
export async function scanProduct(productId: string): Promise<PriceSnapshot> {
  const product = PRODUCTS.find((p) => p.id === productId);
  if (!product) throw new Error(`Unknown product: ${productId}`);
  return runScan({ categories: [product.category] });
}
