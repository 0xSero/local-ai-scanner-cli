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

test("every catalog product is well formed", () => {
  const ids = PRODUCTS.map((p) => p.id);
  expect(new Set(ids).size).toBe(ids.length);
  const categories = new Set(["gpu", "apple", "amd", "memory", "laptop"]);
  for (const product of PRODUCTS) {
    expect(categories.has(product.category)).toBe(true);
    expect(product.name.length).toBeGreaterThan(0);
    expect(Object.keys(product.queries).length).toBeGreaterThan(0);
  }
  // A GPU needs a USD floor: the sources derive their min/max window from it.
  for (const product of productsByCategory("gpu")) {
    expect(typeof product.minPriceUsd).toBe("number");
  }
});

test("productsByCategory partitions the catalog", () => {
  const categories = ["gpu", "apple", "amd", "memory", "laptop"];
  const counted = categories.reduce((total, category) => total + productsByCategory(category).length, 0);
  expect(counted).toBe(PRODUCTS.length);
  for (const category of categories) {
    for (const product of productsByCategory(category)) {
      expect(product.category).toBe(category);
    }
  }
});

test("regions are unique and well formed", () => {
  const codes = REGIONS.map((r) => r.code);
  expect(new Set(codes).size).toBe(codes.length);
  for (const region of REGIONS) {
    expect(region.name.length).toBeGreaterThan(0);
    expect(region.currency).toHaveLength(3);
  }
});

test("importing the barrel registers every source once", () => {
  const sources = allSources();
  const ids = sources.map((s) => s.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const source of sources) {
    expect(source.regions.length).toBeGreaterThan(0);
    expect(source.categories.length).toBeGreaterThan(0);
    expect(typeof source.scan).toBe("function");
  }
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
