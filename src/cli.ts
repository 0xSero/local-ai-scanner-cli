#!/usr/bin/env tsx
/**
 * local-ai-scanner — cached hardware price scanner.
 *
 * Usage:
 *   scan   [--category gpu|apple|amd|memory] [--region US,DE,...]
 *          Fetches current prices from all configured sources and writes a
 *          cached snapshot to cache/latest.json.
 *
 *   prices [--category <c>] [--region <r>] [--condition new|refurbished|used]
 *          Reads the cached snapshot and prints a price table. No network.
 *
 *   sources
 *          Lists the configured data sources and which regions/categories
 *          they cover.
 *
 * The scanner never converts currencies; each price is shown in the retailer's
 * native currency so the table reflects what's actually charged in that market.
 */
import { runScan } from "./scan.js";
import { readLatest } from "./cache.js";
import { PRODUCTS, productsByCategory } from "./products.js";
import { REGIONS } from "./regions.js";
import { allSources } from "./source.js";
import { formatPrice, renderTable } from "./format.js";
import type { HardwareCategory, Condition } from "./types.js";

// Importing source modules registers them via registerSource().
import "./sources/index.js";

const CATEGORIES: HardwareCategory[] = ["gpu", "apple", "amd", "memory"];

function parseArgs(argv: string[]): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = argv[i + 1];
      out[key] = val && !val.startsWith("--") ? val : "true";
    }
  }
  return out;
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);

  switch (cmd) {
    case "scan":
      return cmdScan(args);
    case "prices":
      return cmdPrices(args);
    case "sources":
      return cmdSources();
    default:
      printHelp();
      process.exit(cmd ? 1 : 0);
  }
}

async function cmdScan(args: Record<string, string | undefined>) {
  const categories = parseList(args.category, CATEGORIES);
  const regions = args.region ? args.region.split(",").map((s) => s.trim()) : undefined;
  console.log(`⟳ Scanning ${categories.join(", ")} across ${regions?.join(", ") ?? "all regions"}…\n`);
  const snapshot = await runScan({ categories, regions });
  const byCat = new Map<string, number>();
  for (const l of snapshot.listings) byCat.set(l.category, (byCat.get(l.category) ?? 0) + 1);
  console.log(`✓ ${snapshot.listings.length} listings collected.`);
  for (const [cat, count] of byCat) console.log(`  ${cat}: ${count}`);
  if (snapshot.errors.length) {
    console.log(`\n⚠ ${snapshot.errors.length} source errors:`);
    for (const e of snapshot.errors) console.log(`  ${e.retailer}/${e.region}: ${e.message}`);
  }
  console.log(`\nCached to cache/latest.json at ${snapshot.generatedAt}`);
}

async function cmdPrices(args: Record<string, string | undefined>) {
  const snapshot = await readLatest();
  if (!snapshot) {
    console.log("No cached snapshot found. Run `scan` first.");
    process.exit(1);
  }
  const categories = parseList(args.category, CATEGORIES);
  const regionFilter = args.region ? args.region.split(",").map((s) => s.trim()) : undefined;
  const condition = args.condition as Condition | undefined;

  let listings = snapshot.listings.filter((l) => categories.includes(l.category));
  if (regionFilter) listings = listings.filter((l) => regionFilter.includes(l.region.code));
  if (condition) listings = listings.filter((l) => l.condition === condition);

  const products = categories.flatMap((c) => productsByCategory(c));
  console.log(`Prices as of ${snapshot.generatedAt}  (${listings.length} listings)\n`);

  for (const product of products) {
    const rows = listings
      .filter((l) => l.productId === product.id)
      .sort((a, b) => a.price - b.price);
    if (rows.length === 0) continue;
    const summary = snapshot.summaries[product.id];
    console.log(`■ ${product.name}  (${summary?.retailerCount ?? 0} retailers, ${rows.length} listings)`);
    if (summary && summary.averageNew) {
      console.log(
        `  avg new ${formatPrice(summary.averageNew, rows[0].currency)} · ` +
          `low ${summary.lowestNew ? formatPrice(summary.lowestNew, rows[0].currency) : "—"} · ` +
          `high ${summary.highestNew ? formatPrice(summary.highestNew, rows[0].currency) : "—"}`,
      );
    }
    const tableRows = rows.map((l) => [
      l.retailer,
      l.region.code,
      l.condition,
      formatPrice(l.price, l.currency),
      l.inStock === true ? "in stock" : l.inStock === false ? "oos" : "?",
    ]);
    console.log(renderTable(
      [
        { header: "Retailer", width: 18 },
        { header: "Region", width: 7 },
        { header: "Condition", width: 12 },
        { header: "Price", width: 14, align: "right" },
        { header: "Stock", width: 9 },
      ],
      tableRows,
    ));
    console.log();
  }
}

async function cmdSources() {
  const sources = allSources();
  console.log(`Configured sources (${sources.length}):\n`);
  const rows = sources.map((s) => [s.id, s.name, s.regions.join(","), s.categories.join(",")]);
  console.log(renderTable(
    [
      { header: "ID", width: 18 },
      { header: "Name", width: 26 },
      { header: "Regions", width: 22 },
      { header: "Categories", width: 26 },
    ],
    rows,
  ));
  console.log(`\nRegions: ${REGIONS.map((r) => `${r.code} (${r.currency})`).join(", ")}`);
  console.log(`Products: ${PRODUCTS.length} total`);
}

function parseList(value: string | undefined, valid: HardwareCategory[]): HardwareCategory[] {
  if (!value || value === "true") return valid;
  const parts = value.split(",").map((s) => s.trim() as HardwareCategory);
  return parts.filter((p) => valid.includes(p));
}

function printHelp() {
  console.log(`local-ai-scanner — cached hardware price scanner

Commands:
  scan    [--category gpu,apple,amd,memory] [--region US,DE,GB,JP]
          Fetch current prices from all sources and cache a snapshot.

  prices  [--category <c>] [--region <r>] [--condition new|refurbished|used]
          Print prices from the cached snapshot (no network).

  sources
          List configured data sources.

Examples:
  tsx src/cli.ts scan --category gpu
  tsx src/cli.ts prices --category gpu --region US
  tsx src/cli.ts prices --condition refurbished`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
