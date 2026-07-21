/**
 * No-network smoke test for the library barrel.
 *
 * Verifies the package imports cleanly under Bun, that importing the barrel
 * registers all built-in retailer sources (so `runScan` is usable without any
 * extra setup), and that the pure helpers behave on empty input. Run with
 * `bun test`. No network access — `runScan` itself is not invoked here.
 *
 * Lives outside the tsconfig `include` (`src/**`, `lib/**`) so `tsc --noEmit`
 * does not typecheck the `bun:test` ambient types.
 */
import { test, expect } from "bun:test";
import {
  runScan,
  scanProduct,
  readLatest,
  writeSnapshot,
  listSnapshots,
  defaultCacheDir,
  PRODUCTS,
  productsByCategory,
  REGIONS,
  allSources,
  summarizeAll,
  formatPrice,
  buildPriceEvolution,
} from "../src/index.js";

test("barrel re-exports the public API", () => {
  expect(typeof runScan).toBe("function");
  expect(typeof scanProduct).toBe("function");
  expect(typeof readLatest).toBe("function");
  expect(typeof writeSnapshot).toBe("function");
  expect(typeof listSnapshots).toBe("function");
  expect(typeof defaultCacheDir).toBe("function");
  expect(typeof formatPrice).toBe("function");
});

test("catalog constants match the source of truth", () => {
  expect(PRODUCTS).toHaveLength(43);
  expect(REGIONS).toHaveLength(5);
  expect(productsByCategory("gpu")).toHaveLength(20);
  expect(productsByCategory("apple")).toHaveLength(16);
  expect(productsByCategory("amd")).toHaveLength(2);
  expect(productsByCategory("memory")).toHaveLength(5);
});

test("importing the barrel registers all 15 retailer sources", () => {
  expect(allSources()).toHaveLength(15);
});

test("pure helpers behave on empty input", () => {
  expect(summarizeAll([])).toEqual({});
  expect(formatPrice(1599.99, "USD")).toBe("$1,599.99");
});

test("defaultCacheDir points at <cwd>/cache", () => {
  expect(defaultCacheDir()).toBe(`${process.cwd()}/cache`);
});

test("buildPriceEvolution on a missing cache dir returns an empty report", async () => {
  const evo = await buildPriceEvolution("/tmp/scanner-no-such-cache-dir");
  expect(evo.snapshotsAnalyzed).toBe(0);
  expect(Object.keys(evo.products)).toHaveLength(0);
  expect(evo.snapshotTimestamps).toEqual([]);
});
