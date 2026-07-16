/**
 * Export scan data as CSV + JSON for exploration.
 *
 * Reads the cached snapshot and writes:
 *   data/listings.json  — all raw listings (pretty-printed)
 *   data/listings.csv   — flat CSV of all listings
 *   data/summaries.json — per-product aggregate stats
 *   data/summaries.csv  — flat CSV of per-product stats
 *   data/errors.json    — source errors from the last scan
 *   data/errors.csv     — flat CSV of source errors
 *   data/snapshot.json  — the full snapshot (listings + summaries + errors)
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import type { PriceListing, ProductPriceSummary, SourceError } from "./types.js";

type CsvValue = string | number | boolean | null | undefined;

function csvEscape(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv(rows: CsvValue[][]): string {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

async function main() {
  mkdirSync("data", { recursive: true });

  const snap = JSON.parse(readFileSync("cache/latest.json", "utf8"));
  const listings = snap.listings as PriceListing[];
  const summaries = Object.values(snap.summaries) as ProductPriceSummary[];
  const errors = snap.errors as SourceError[];

  // ── Full snapshot JSON ──
  writeFileSync("data/snapshot.json", JSON.stringify(snap, null, 2));
  console.log("data/snapshot.json");

  // ── Listings JSON ──
  writeFileSync("data/listings.json", JSON.stringify(listings, null, 2));
  console.log(`data/listings.json (${listings.length} listings)`);

  // ── Listings CSV ──
  const listingHeaders = [
    "productId", "productName", "category", "retailer", "region", "regionName",
    "currency", "condition", "price", "inStock", "quantity", "url", "fetchedAt",
  ];
  const listingRows = listings.map((l) => [
    l.productId, l.productName, l.category, l.retailer, l.region.code,
    l.region.name, l.currency, l.condition, l.price,
    l.inStock, l.quantity, l.url, l.fetchedAt,
  ]);
  writeFileSync("data/listings.csv", toCsv([listingHeaders, ...listingRows]));
  console.log(`data/listings.csv (${listings.length} rows)`);

  // ── Summaries JSON ──
  writeFileSync("data/summaries.json", JSON.stringify(summaries, null, 2));
  console.log(`data/summaries.json (${summaries.length} products)`);

  // ── Summaries CSV ──
  const summaryHeaders = [
    "productId", "listingCount", "currency", "lowestNew", "highestNew",
    "averageNew", "medianNew", "lowestRefurbished", "lowestUsed",
    "retailerCount", "regionCount", "inStockCount",
  ];
  const summaryRows = summaries.map((s) => [
    s.productId, s.listingCount, s.currency, s.lowestNew, s.highestNew,
    s.averageNew, s.medianNew, s.lowestRefurbished, s.lowestUsed,
    s.retailerCount, s.regionCount, s.inStockCount,
  ]);
  writeFileSync("data/summaries.csv", toCsv([summaryHeaders, ...summaryRows]));
  console.log(`data/summaries.csv (${summaries.length} rows)`);

  // ── Errors JSON ──
  writeFileSync("data/errors.json", JSON.stringify(errors, null, 2));
  console.log(`data/errors.json (${errors.length} errors)`);

  // ── Errors CSV ──
  const errorHeaders = ["retailer", "region", "message"];
  const errorRows = errors.map((e) => [e.retailer, e.region, e.message]);
  writeFileSync("data/errors.csv", toCsv([errorHeaders, ...errorRows]));
  console.log(`data/errors.csv (${errors.length} rows)`);

  console.log(`\n✓ Exported ${listings.length} listings, ${summaries.length} summaries, ${errors.length} errors`);
}

main();
