/**
 * Newegg source — US retailer with embedded JSON in `window.__initialState__`.
 *
 * Confirmed structure: the search results page (`/p/pl?d=QUERY&Order=2`)
 * contains a JS object literal `window.__initialState__ = {...}` whose
 * `Products[]` array holds `ItemCell` objects with `UnitCost` (number),
 * `Instock` (boolean), and `Description.Title` (string). No API key, no
 * Cloudflare — only needs a desktop User-Agent.
 *
 * We sort by price ascending (`Order=2`) and take the cheapest matches so the
 * average/low stats reflect real offers, not outlier markups.
 */
import type { PriceListing, Product, SourceError } from "../types.js";
import type { Source, SourceResult } from "../source.js";
import { fetchText, fetchError } from "../http.js";
import { regionOf } from "../regions.js";
import { queryFor } from "../products.js";

const SEARCH_URL = "https://www.newegg.com/p/pl?d=";

/** Extract and parse the `window.__initialState__` JSON object from the page. */
function parseInitialState(html: string): Record<string, unknown> | null {
  const marker = "window.__initialState__";
  const idx = html.indexOf(marker);
  if (idx === -1) return null;
  let i = idx + marker.length;
  while (i < html.length && html[i] !== "{") i++;
  let depth = 0;
  const start = i;
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

/** Check if all significant words from the query appear in the product title. */
function titleMatches(title: string, query: string): boolean {
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const t = norm(title);
  const words = norm(query).split(" ").filter((w) => w.length > 1);
  return words.every((w) => t.includes(w));
}

/**
 * Keywords that indicate a listing is a complete system (pre-built PC,
 * workstation, server) rather than a standalone component. Applied to GPU
 * searches where a $40K "RTX 5090" result is actually a gaming PC that
 * happens to contain the card.
 */
const SYSTEM_KEYWORDS = [
  "desktop", "laptop", "workstation", "server", "prebuilt", "pre-built",
  "tower", "barebone", "gaming pc", "pc build", "gaming desktop",
  "custom pc", "build pc", "pc bundle", "combo", "barebones",
  "fully loaded", "system", "configured",
];

/**
 * Per-product max price multiplier — a listing above `minPriceUsd * multiplier`
 * is almost certainly a complete system, not a standalone card. Applied in
 * addition to the category-level MAX_PRICE.
 */
const MAX_PRICE_MULTIPLIER = 8;

/**
 * Maximum price per category (USD, Newegg is US-only). Filters out complete
 * systems and bundles that match the search query but aren't standalone parts.
 */
const MAX_PRICE: Record<string, number> = {
  gpu: 15000,
  memory: 2000,
  amd: 5000,
};

interface NeweggItemCell {
  Item: string;
  UnitCost: number;
  Instock: boolean;
  Description?: { Title?: string };
  ItemManufactory?: { Manufactory?: string };
}

async function scanNewegg(
  products: Product[],
  regionCode: string,
): Promise<SourceResult> {
  const region = regionOf(regionCode);
  const listings: PriceListing[] = [];
  const errors: SourceError[] = [];
  const now = new Date().toISOString();

  for (const product of products) {
    const query = queryFor(product, "newegg");
    const url = `${SEARCH_URL}${encodeURIComponent(query)}&Order=2`;
    const res = await fetchText(url);
    if (!res.ok) {
      errors.push(fetchError("newegg", regionCode, res));
      continue;
    }
    const state = parseInitialState(res.body);
    if (!state) {
      errors.push({ retailer: "newegg", region: regionCode, message: "no __initialState__ found" });
      continue;
    }
    const productRows = (state.Products as { ItemCell: NeweggItemCell }[]) ?? [];
    let matched = 0;
    const catMax = MAX_PRICE[product.category] ?? Infinity;
    // Per-product max: if we know the card's MSRP (minPriceUsd), a listing
    // above 2.5× that is almost certainly a complete system bundle.
    const productMax = product.minPriceUsd
      ? product.minPriceUsd * MAX_PRICE_MULTIPLIER
      : Infinity;
    const maxPrice = Math.min(catMax, productMax);
    const minPrice = product.minPriceUsd ?? 0;
    for (const row of productRows) {
      const cell = row.ItemCell;
      if (!cell || !cell.UnitCost || cell.UnitCost <= 0) continue;
      const title = cell.Description?.Title ?? "";
      if (!titleMatches(title, query)) continue;
      // Exclude complete systems that contain the GPU but aren't standalone cards
      const normTitle = title.toLowerCase();
      if (product.category === "gpu" && SYSTEM_KEYWORDS.some((kw) => normTitle.includes(kw))) continue;
      if (cell.UnitCost < minPrice || cell.UnitCost > maxPrice) continue;
      listings.push({
        productId: product.id,
        productName: product.name,
        category: product.category,
        retailer: "newegg",
        region,
        condition: "new",
        price: cell.UnitCost,
        currency: region.currency,
        url: `https://www.newegg.com/p/${encodeURIComponent(cell.Item)}`,
        inStock: cell.Instock ?? null,
        quantity: null,
        fetchedAt: now,
      });
      matched++;
      if (matched >= 8) break; // cap per product to keep the snapshot compact
    }
    // Brief delay between products to be polite
    await new Promise((r) => setTimeout(r, 400));
  }

  return { listings, errors };
}

export const neweggSource: Source = {
  id: "newegg",
  name: "Newegg",
  regions: ["US"],
  categories: ["gpu", "memory", "amd"],
  scan: (products, ctx) => scanNewegg(products, ctx.regionCode),
};
