/**
 * Data loader — server-only. Reads the CLI's cached snapshot at build time.
 *
 * The website is a static view of the cached prices. It reads
 * `../cache/latest.json` (written by the CLI's `scan` command) and exposes
 * typed helpers for server components. Client components use lib/catalog.ts
 * instead, which contains no Node.js imports.
 */
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { PriceSnapshot } from "../../src/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = join(__dirname, "..", "..", "cache", "latest.json");

let cached: PriceSnapshot | null = null;

/** Load the cached snapshot (memoized for the duration of a build/request). */
export async function loadSnapshot(): Promise<PriceSnapshot> {
  if (cached) return cached;
  const raw = await readFile(CACHE_PATH, "utf8");
  cached = JSON.parse(raw) as PriceSnapshot;
  return cached;
}

/** All listings for a given category. */
export function listingsByCategory(snapshot: PriceSnapshot, category: string) {
  return snapshot.listings.filter((l) => l.category === category);
}
