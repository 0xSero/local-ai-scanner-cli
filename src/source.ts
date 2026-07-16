/**
 * The contract every retailer/source module implements.
 *
 * A source scans one region for a set of products and returns normalized
 * {@link PriceListing} rows. Sources are registered in the {@link SOURCES}
 * map keyed by id (the same ids referenced in regions.ts `sources` arrays and
 * in product `queries`).
 */
import type { HardwareCategory, PriceListing, Product, SourceError } from "./types.js";

export interface SourceContext {
  /** Region code this source is scanning, e.g. "US". */
  regionCode: string;
}

export interface SourceResult {
  listings: PriceListing[];
  errors: SourceError[];
}

export interface Source {
  /** Stable id, e.g. "microcenter". Must match regions.ts and product queries. */
  id: string;
  /** Display name. */
  name: string;
  /** Which regions this source covers (region codes). */
  regions: string[];
  /** Categories this source can price. Sources may skip categories they don't carry. */
  categories: HardwareCategory[];
  /**
   * Scan a region for the given products.
   * Implementations should fetch, parse, and return normalized listings.
   * Failures for individual products should be recorded in `errors`, not thrown.
   */
  scan(products: Product[], ctx: SourceContext): Promise<SourceResult>;
}

/** Registry of all known sources. Populated as modules are imported. */
const SOURCES = new Map<string, Source>();

export function registerSource(source: Source): void {
  SOURCES.set(source.id, source);
}

export function getSource(id: string): Source | undefined {
  return SOURCES.get(id);
}

export function allSources(): Source[] {
  return [...SOURCES.values()];
}

export function sourcesForRegion(regionCode: string): Source[] {
  return allSources().filter((s) => s.regions.includes(regionCode));
}
