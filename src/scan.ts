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
  /** Persist the snapshot to the cache directory. Defaults to `false` so
   * library callers get an in-memory result without side effects; the CLI
   * sets this to `true` to keep its cache-writing behavior. */
  persist?: boolean;
  /** Cache directory to write to when `persist` is true. Defaults to
   * {@link defaultCacheDir} (`<cwd>/cache`). */
  cacheDir?: string;
  /** Optional progress callback — fired when a source starts and when it
   * finishes. The CLI uses this to print what it's hitting as it goes;
   * library callers can ignore it. */
  onProgress?: (event: ScanProgress) => void;
}

/** A progress event from the scan loop. `phase: "start"` fires before a source
 * is hit; `phase: "done"` fires after, with the counts it returned. */
export interface ScanProgress {
  region: string;
  source: string;
  phase: "start" | "done";
  /** Products being fetched (start only). */
  productCount?: number;
  /** Listings returned (done only). */
  listings?: number;
  /** Errors recorded (done only). */
  errors?: number;
}

/** Run a full scan. By default returns the snapshot in memory without writing
 * to disk; pass `{ persist: true }` to also write it to the cache directory
 * (matching the CLI's behavior). Failed sources are recorded in the snapshot
 * rather than aborting the whole scan, so a partial result is always returned. */
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
      options.onProgress?.({ region: code, source: source.id, phase: "start", productCount: relevant.length });
      try {
        const result = await source.scan(relevant, { regionCode: code });
        allListings.push(...result.listings);
        allErrors.push(...result.errors);
        options.onProgress?.({ region: code, source: source.id, phase: "done", listings: result.listings.length, errors: result.errors.length });
      } catch (err) {
        allErrors.push({ retailer: source.id, region: code, message: `source crashed: ${String(err)}` });
        options.onProgress?.({ region: code, source: source.id, phase: "done", listings: 0, errors: 1 });
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

  if (options.persist) {
    await writeSnapshot(snapshot, options.cacheDir);
  }
  return snapshot;
}

/** Convenience: scan a single product id across all regions/sources. */
export async function scanProduct(productId: string): Promise<PriceSnapshot> {
  const product = PRODUCTS.find((p) => p.id === productId);
  if (!product) throw new Error(`Unknown product: ${productId}`);
  return runScan({ categories: [product.category] });
}
