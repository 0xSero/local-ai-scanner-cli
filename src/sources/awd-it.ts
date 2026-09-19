/**
 * AWD-IT source — UK retailer (GBP), Magento 2 store.
 *
 * The search page (`/catalogsearch/result/?q=QUERY`) returns server-rendered
 * Magento HTML with `.product-item` cards. Each card has:
 *   - `.product-item-link`  → product title + URL
 *   - `[data-price-amount]` → numeric price (first = incl. tax, the shelf price)
 *   - `.stock` / `.stock-status` → "In stock", "Out of stock", "Configure"
 *
 * No anti-bot; plain HTTP GET with a desktop UA. Magento is a common e-commerce
 * platform so the selectors are stable across Magento-based retailers.
 *
 * Search results include pre-built PCs and monitors that match GPU queries, so
 * we filter with the shared accessory and system matchers.
 */
import * as cheerio from "cheerio";
import type { PriceListing, Product, SourceError } from "../types.js";
import type { Source, SourceResult } from "../source.js";
import { fetchText, fetchError, sleep } from "../http.js";
import { regionOf } from "../regions.js";
import { queryFor } from "../products.js";
import { titleMatches, isAccessoryListing, isSystemListing } from "./listing-match.js";

const SEARCH_URL = "https://www.awd-it.co.uk/catalogsearch/result/?q=";

/**
 * Minimum price per category (GBP). Filters accessories and low-end parts
 * that match the search query but aren't the actual product.
 */
const MIN_PRICE: Record<string, number> = {
  gpu: 120,
  apple: 320,
  memory: 22,
  amd: 400,
};

/**
 * Maximum price multiplier — a listing above `minPriceUsd * multiplier` is
 * almost certainly a complete system or extreme markup, not a standalone part.
 */
const MAX_PRICE_MULTIPLIER = 4;

/** Rough USD → GBP conversion for per-product price floors. */
const USD_TO_GBP = 0.79;

function parsePrice(text: string): number | null {
  // Magento prices are like "£1,199.95" — strip symbol, remove commas
  const cleaned = text.replace(/[^\d.]/g, "").trim();
  if (!cleaned) return null;
  return parseFloat(cleaned);
}

/**
 * Parse stock from Magento stock indicators.
 * "In stock" → inStock true. "Out of stock" → inStock false, quantity 0.
 * "Configure" / "Built to order" → inStock true (available, just configurable).
 */
function parseStock(stockText: string): { inStock: boolean | null; quantity: number | null } {
  const norm = stockText.toLowerCase().trim();
  if (/out\s*of\s*stock|unavailable/i.test(norm)) {
    return { inStock: false, quantity: 0 };
  }
  if (/in\s*stock|available|configure|built\s*to\s*order/i.test(norm)) {
    return { inStock: true, quantity: null };
  }
  return { inStock: null, quantity: null };
}

async function scanAwdIt(
  products: Product[],
  regionCode: string,
): Promise<SourceResult> {
  const region = regionOf(regionCode);
  const listings: PriceListing[] = [];
  const errors: SourceError[] = [];
  const now = new Date().toISOString();

  for (const product of products) {
    const query = queryFor(product, "awd-it");
    const url = `${SEARCH_URL}${encodeURIComponent(query)}`;
    const res = await fetchText(url);
    if (!res.ok) {
      errors.push(fetchError("awd-it", regionCode, res));
      continue;
    }
    const $ = cheerio.load(res.body);
    let matched = 0;
    const catFloor = MIN_PRICE[product.category] ?? 0;
    const productFloor = product.minPriceUsd
      ? product.minPriceUsd * USD_TO_GBP
      : 0;
    const minPrice = Math.max(catFloor, productFloor);
    const maxPrice = product.minPriceUsd
      ? product.minPriceUsd * MAX_PRICE_MULTIPLIER * USD_TO_GBP
      : Infinity;

    $(".product-item").each((_, el) => {
      if (matched >= 8) return;
      const $el = $(el);
      const title = $el.find(".product-item-link").text().trim();
      if (!titleMatches(title, query)) return;
      // A card's name appears in the title of its water block and its cable
      if (isAccessoryListing(title)) return;
      // AWD-IT lists pre-built systems that contain the card
      if (isSystemListing(title, product.category)) return;
      // Price: first [data-price-amount] is the incl-tax shelf price
      const priceText = $el.find("[data-price-amount]").first().attr("data-price-amount") ?? "";
      const price = parseFloat(priceText);
      if (isNaN(price) || price < minPrice || price > maxPrice) return;
      const href = $el.find(".product-item-link").attr("href") ?? url;
      // Stock: Magento uses .stock or .stock-status
      const stockText = $el.find(".stock, .stock-status").first().text().trim();
      const { inStock, quantity } = parseStock(stockText);
      listings.push({
        productId: product.id,
        productName: product.name,
        category: product.category,
        retailer: "awd-it",
        region,
        condition: "new",
        price,
        currency: region.currency,
        url: href.startsWith("http") ? href : `https://www.awd-it.co.uk${href}`,
        inStock,
        quantity,
        fetchedAt: now,
      });
      matched++;
    });
    await sleep(600);
  }

  return { listings, errors };
}

export const awdItSource: Source = {
  id: "awd-it",
  name: "AWD-IT",
  regions: ["GB"],
  categories: ["gpu", "memory", "amd"],
  scan: (products, ctx) => scanAwdIt(products, ctx.regionCode),
};
