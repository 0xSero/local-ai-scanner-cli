/**
 * Apple Online Store source — new pricing for current-gen Apple Silicon.
 *
 * Apple's buy pages (`/{cc}/shop/buy-mac/mac-studio`, `.../macbook-pro`)
 * contain embedded chip-keyed price objects in a `<script>` block. The keys
 * look like `"m3ultra-28-60"` and each maps to an object with
 * `currentPrice.raw_amount` (numeric string) and `currentPrice.amount`
 * (localized string like "$5,299.00").
 *
 * The enclosing script block is a JS object literal (unquoted top-level keys),
 * so we brace-match each chip sub-object individually rather than parsing the
 * whole block. No anti-bot; plain HTTP GET works across ~40 country stores.
 *
 * Country prefixes: US → (none), DE → /de, GB → /uk, JP → /jp.
 *
 * Only current-gen chips appear on the new store. Discontinued chips (M1/M2
 * Max, M1/M2 Ultra) yield no listings here — they're handled by the
 * refurbished source instead.
 */
import type { PriceListing, SourceError } from "../types.js";
import type { Source, SourceResult } from "../source.js";
import { fetchText, fetchError } from "../http.js";
import { regionOf } from "../regions.js";
import { appleProducts } from "../products.js";

const COUNTRY_PREFIX: Record<string, string> = {
  US: "",
  DE: "/de",
  GB: "/uk",
  JP: "/jp",
  PL: "/pl",
};

interface ChipPrice {
  currentPrice?: { raw_amount?: string; amount?: string };
  amount?: number;
  /** MacBook Pro / Mac mini pages use priceKey indirection. */
  priceKey?: string;
}

/** Brace-match the JSON object starting at `start` in `html`. Returns the parsed object or null. */
function braceMatch(html: string, start: number): unknown | null {
  if (html[start] !== "{") return null;
  let depth = 0;
  let i = start;
  for (; i < html.length; i++) {
    if (html[i] === "{") depth++;
    else if (html[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  try {
    return JSON.parse(html.slice(start, i + 1));
  } catch {
    return null;
  }
}

/**
 * Resolve a priceKey (e.g. "14inch-silver-standard-m5max-18-32") to its
 * currentPrice object by finding that key elsewhere in the HTML.
 */
function resolvePriceKey(html: string, priceKey: string): ChipPrice | null {
  const escaped = priceKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`"${escaped}"\\s*:\\s*\\{`, "g");
  const m = regex.exec(html);
  if (!m) return null;
  const obj = braceMatch(html, m.index + m[0].length - 1);
  if (obj && typeof obj === "object") return obj as ChipPrice;
  return null;
}

/**
 * Extract all chip-keyed prices from the buy-page HTML.
 *
 * Two page structures exist:
 * - Mac Studio: chip-keyed objects (`"m3ultra-28-60": {...}`) contain
 *   `currentPrice.raw_amount` directly.
 * - MacBook Pro / Mac mini: chip-keyed objects have `dimensionComponents`
 *   (no price). Prices live in separate objects whose KEY is a priceKey
 *   string that embeds the chip id (e.g. `"14inch-silver-standard-m5max-18-32"`).
 *   We find these by searching for any key containing a chip pattern that has
 *   a `currentPrice.raw_amount` inside.
 *
 * Returns a map of chip key → lowest price found (multiple configs per chip
 * may exist; we keep the cheapest as the "starting at" price).
 */
function extractChipPrices(html: string): Map<string, number> {
  const out = new Map<string, number>();

  // Pass 1: direct chip-keyed prices (Mac Studio)
  const chipKeyRegex = /"(m\d+[a-z]*-\d+-\d+)"\s*:\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = chipKeyRegex.exec(html)) !== null) {
    const chipKey = m[1];
    const obj = braceMatch(html, m.index! + m[0].length - 1) as ChipPrice | null;
    if (!obj) continue;
    const rawAmount = obj.currentPrice?.raw_amount;
    if (rawAmount) {
      const price = parseFloat(rawAmount);
      if (price > 0) {
        const existing = out.get(chipKey);
        if (existing === undefined || price < existing) out.set(chipKey, price);
      }
    }
  }

  // Pass 2: priceKey-keyed prices (MacBook Pro, Mac mini)
  // Find any object whose key contains a chip pattern and has currentPrice
  const priceKeyRegex = /"([^"]*(?:m\d+[a-z]*-\d+-\d+)[^"]*)"\s*:\s*\{/g;
  while ((m = priceKeyRegex.exec(html)) !== null) {
    const key = m[1];
    const obj = braceMatch(html, m.index! + m[0].length - 1) as ChipPrice | null;
    if (!obj?.currentPrice?.raw_amount) continue;
    const chipMatch = key.match(/(m\d+[a-z]*-\d+-\d+)/);
    if (!chipMatch) continue;
    const chipKey = chipMatch[1];
    const price = parseFloat(obj.currentPrice.raw_amount);
    if (price > 0) {
      const existing = out.get(chipKey);
      if (existing === undefined || price < existing) out.set(chipKey, price);
    }
  }

  return out;
}

/** Extract currency code from the embedded metrics JSON, if present. */
function extractCurrency(html: string): string | null {
  const m = html.match(/<script[^>]*type="application\/json"[^>]*id="metrics"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    const obj = JSON.parse(m[1]);
    return obj?.data?.properties?.currencyCode ?? null;
  } catch {
    return null;
  }
}

/** Map an appleChip like "m3ultra" to a human-readable chip label for display. */
function chipLabel(chip: string): string {
  return chip
    .replace(/max/i, " Max")
    .replace(/ultra/i, " Ultra")
    .replace(/(\d+)/, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

async function scanAppleStore(regionCode: string): Promise<SourceResult> {
  const prefix = COUNTRY_PREFIX[regionCode];
  if (prefix === undefined) return { listings: [], errors: [] };
  const region = regionOf(regionCode);
  const listings: PriceListing[] = [];
  const errors: SourceError[] = [];
  const now = new Date().toISOString();

  // Determine which buy pages we need (deduplicated by applePage)
  const appleProds = appleProducts();
  const pages = new Set(appleProds.map((p) => p.applePage!));
  // Map chip prefix → products (e.g. "m3ultra" → [mac-studio-m3-ultra])
  const chipToProducts = new Map<string, typeof appleProds>();
  for (const p of appleProds) {
    const arr = chipToProducts.get(p.appleChip!) ?? [];
    arr.push(p);
    chipToProducts.set(p.appleChip!, arr);
  }

  for (const page of pages) {
    const url = `https://www.apple.com${prefix}/shop/buy-mac/${page}`;
    const res = await fetchText(url);
    if (!res.ok) {
      errors.push(fetchError("apple-store", regionCode, res));
      continue;
    }
    const currency = extractCurrency(res.body) ?? region.currency;
    const chipPrices = extractChipPrices(res.body);

    for (const [chipKey, price] of chipPrices) {
      // Extract the chip family prefix: "m3ultra-28-60" → "m3ultra"
      const chipFamily = chipKey.replace(/-\d+-\d+$/, "");
      const matched = chipToProducts.get(chipFamily);
      if (!matched || matched.length === 0) continue;
      // Match only products whose applePage matches this page
      for (const product of matched.filter((p) => p.applePage === page)) {
        listings.push({
          productId: product.id,
          productName: `${product.name} (${chipKey})`,
          category: product.category,
          retailer: "apple-store",
          region: { ...region, currency },
          condition: "new",
          price,
          currency,
          url,
          inStock: true,
          quantity: null,
          fetchedAt: now,
        });
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  return { listings, errors };
}

export const appleStoreSource: Source = {
  id: "apple-store",
  name: "Apple Store (new)",
  regions: ["US", "DE", "GB", "JP", "PL"],
  categories: ["apple"],
  scan: (_products, ctx) => scanAppleStore(ctx.regionCode),
};
