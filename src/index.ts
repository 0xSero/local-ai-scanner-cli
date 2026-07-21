/**
 * Library entry point for local-ai-scanner-cli.
 *
 * Importing from this module gives access to the scanner's public API: the
 * scan orchestrator, cache layer, product/region/source catalogs, aggregate
 * stats, formatting helpers, and the Effect schemas that validate data at
 * trust boundaries.
 *
 * Importing this module also registers all built-in retailer sources (via the
 * side-effect import of `./sources/index.js`), so `runScan()` works without
 * any further setup:
 *
 * ```ts
 * import { runScan } from "local-ai-scanner-cli";
 * // In-memory snapshot, no disk writes:
 * const snapshot = await runScan({ categories: ["gpu"] });
 * // Opt into persisting to a cache directory:
 * await runScan({ categories: ["gpu"], persist: true, cacheDir: "./cache" });
 * ```
 *
 * The CLI entry points (`cli.ts`, `export-data.ts`) are intentionally NOT
 * re-exported here — they parse `process.argv` and run side effects on import.
 * Use the `local-ai-scanner-cli` bin (or `src/cli.ts` directly) to run them.
 */
import "./sources/index.js";

export * from "./scan.js";
export * from "./cache.js";
export * from "./products.js";
export * from "./source.js";
export * from "./regions.js";
export * from "./stats.js";
export * from "./format.js";
export * from "./http.js";
export * from "./types.js";
