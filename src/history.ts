/**
 * Price evolution — compares cached snapshots over time to show how prices
 * changed between scans.
 *
 * Each `scan` with `persist: true` writes a timestamped archive
 * (`cache/snapshot-<ts>.json`) plus `latest.json`. This module reads every
 * archived snapshot (and `latest.json`, so a fresh clone with no archives
 * still sees the committed snapshot), sorts them oldest → newest, and builds
 * a per-product price history with deltas between consecutive points.
 *
 * Exposed as the `history` CLI command, which prints the evolution as JSON:
 *   bunx local-ai-scanner-cli history > evolution.json
 */
import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { PriceSnapshot, ProductPriceSummary } from "./types.js";
import { PriceSnapshotSchema } from "./types.js";
import { decode, runPromise } from "../lib/effect.js";
import { defaultCacheDir } from "./cache.js";
import { getProduct } from "./products.js";

/** A single snapshot's headline stats for one product. */
export interface PricePoint {
  /** ISO-8601 timestamp of the snapshot this point comes from. */
  snapshotAt: string;
  /** Currency the stats are reported in (stats are computed per-currency). */
  currency: string;
  lowestNew: number | null;
  averageNew: number | null;
  medianNew: number | null;
  /** Distinct retailers with at least one listing in this snapshot. */
  retailerCount: number;
  /** Total listings for this product in this snapshot. */
  listingCount: number;
}

/** How stats changed vs the previous snapshot. `null` when either side is
 * missing or the currency differs — you can't diff $1,599 against ¥899,800. */
export interface PriceChange {
  /** Absolute change in lowest new price. */
  lowestNewDelta: number | null;
  /** Absolute change in average new price. */
  averageNewDelta: number | null;
  /** Percent change in lowest new price vs the prior point. */
  lowestNewPct: number | null;
  /** Percent change in average new price vs the prior point. */
  averageNewPct: number | null;
}

/** A product's price history across all snapshots, oldest → newest. */
export interface ProductHistory {
  productId: string;
  productName: string;
  category: string;
  /** One entry per snapshot that included this product. Consecutive points
   * carry a `change` delta vs the previous point. */
  points: Array<PricePoint & { change?: PriceChange }>;
}

/** The full price-evolution report across all cached snapshots. */
export interface PriceEvolution {
  /** ISO-8601 timestamp this report was generated. */
  generatedAt: string;
  /** Number of snapshots compared. */
  snapshotsAnalyzed: number;
  /** Timestamps of every snapshot, oldest → newest. */
  snapshotTimestamps: string[];
  /** Per-product histories, keyed by product id. */
  products: Record<string, ProductHistory>;
}

/**
 * Build a price-evolution report from every cached snapshot in `cacheDir`.
 *
 * Reads all `snapshot-*.json` archives plus `latest.json`, dedupes by
 * `generatedAt`, and sorts oldest → newest. For each product appearing in any
 * snapshot, collects its headline stats per snapshot and computes the delta
 * from the previous snapshot (same currency only). Snapshots that fail schema
 * validation are skipped rather than aborting, so a single corrupt archive
 * doesn't block the report.
 */
export async function buildPriceEvolution(
  cacheDir: string = defaultCacheDir(),
): Promise<PriceEvolution> {
  if (!existsSync(cacheDir)) {
    return { generatedAt: new Date().toISOString(), snapshotsAnalyzed: 0, snapshotTimestamps: [], products: {} };
  }

  const files = await readdir(cacheDir);
  const candidates = files.filter((f) => f.startsWith("snapshot-") || f === "latest.json");

  // Read + validate each candidate, deduping by generatedAt so latest.json
  // (which duplicates the most recent archive) isn't counted twice.
  const seen = new Set<string>();
  const snapshots: PriceSnapshot[] = [];
  for (const f of candidates) {
    const path = join(cacheDir, f);
    try {
      const raw = await readFile(path, "utf8");
      const parsed = JSON.parse(raw);
      const validated = await runPromise(decode(PriceSnapshotSchema, path)(parsed));
      const snap = validated as unknown as PriceSnapshot;
      if (!seen.has(snap.generatedAt)) {
        seen.add(snap.generatedAt);
        snapshots.push(snap);
      }
    } catch {
      // skip unreadable / schema-invalid snapshots
    }
  }

  // Oldest → newest so deltas read forward in time.
  snapshots.sort((a, b) => a.generatedAt.localeCompare(b.generatedAt));

  // Collect every product id that appears in any snapshot's summaries.
  const productIds = new Set<string>();
  for (const s of snapshots) {
    for (const id of Object.keys(s.summaries)) productIds.add(id);
  }

  const products: Record<string, ProductHistory> = {};
  for (const id of productIds) {
    const catalog = getProduct(id);
    const points: Array<PricePoint & { change?: PriceChange }> = [];
    let prev: PricePoint | null = null;

    for (const s of snapshots) {
      const summary = s.summaries[id];
      if (!summary) continue;
      const point: PricePoint & { change?: PriceChange } = {
        snapshotAt: s.generatedAt,
        currency: summary.currency,
        lowestNew: summary.lowestNew,
        averageNew: summary.averageNew,
        medianNew: summary.medianNew,
        retailerCount: summary.retailerCount,
        listingCount: summary.listingCount,
      };
      if (prev && prev.currency === summary.currency) {
        point.change = computeChange(prev, summary);
      }
      points.push(point);
      prev = point;
    }

    if (points.length === 0) continue;
    products[id] = {
      productId: id,
      productName: catalog?.name ?? id,
      category: catalog?.category ?? "unknown",
      points,
    };
  }

  return {
    generatedAt: new Date().toISOString(),
    snapshotsAnalyzed: snapshots.length,
    snapshotTimestamps: snapshots.map((s) => s.generatedAt),
    products,
  };
}

/** Compute the delta between two same-currency summary points. */
function computeChange(prev: PricePoint, curr: ProductPriceSummary): PriceChange {
  const prevLowest = prev.lowestNew;
  const prevAvg = prev.averageNew;
  const lowestDelta =
    curr.lowestNew != null && prevLowest != null ? curr.lowestNew - prevLowest : null;
  const avgDelta =
    curr.averageNew != null && prevAvg != null ? curr.averageNew - prevAvg : null;
  return {
    lowestNewDelta: lowestDelta,
    averageNewDelta: avgDelta,
    lowestNewPct: lowestDelta != null && prevLowest != null && prevLowest !== 0 ? (lowestDelta / prevLowest) * 100 : null,
    averageNewPct: avgDelta != null && prevAvg != null && prevAvg !== 0 ? (avgDelta / prevAvg) * 100 : null,
  };
}
