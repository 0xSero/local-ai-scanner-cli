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
 * we filter with SYSTEM_KEYWORDS and ACCESSORY_KEYWORDS like the Amazon source.
 */
import * as cheerio from "cheerio";
import type { PriceListing, Product, SourceError } from "../types.js";
import type { Source, SourceResult } from "../source.js";
import { fetchText, fetchError } from "../http.js";
import { regionOf } from "../regions.js";
import { queryFor } from "../products.js";

const SEARCH_URL = "https://www.awd-it.co.uk/catalogsearch/result/?q=";

/** Accessory keywords — listings that match the query but aren't the product. */
const ACCESSORY_KEYWORDS = [
  "cable", "adapter", "bracket", "riser", "extension", "connector",
  "fan", "cooler", "thermal", "pad", "holder", "stand", "mount",
  "screw", "washer", "cord", "wire", "case fan", "power supply",
  "bracket kit", "support", "anti-sag", "water block", "waterblock",
  "backplate", "deshroud", "replacement", "repair", "decals", "sticker",
  "keycap", "mousepad", "poster", "shirt", "mug", "monitor", "case",
  "mid tower", "atx case",
];

/**
 * Keywords that indicate a listing is a complete system (pre-built PC,
 * workstation, gaming PC) rather than a standalone component. AWD-IT sells
 * many pre-built systems that contain the GPU in their name.
 */
const SYSTEM_KEYWORDS = [
  "desktop", "workstation", "server", "prebuilt", "pre-built", "prebuilt gaming pc",
  "tower", "barebone", "gaming pc", "pc build", "system",
  "configured", "bundle", "ryzen", "intel core", "ddr5 ram",
  "ssd", "windows 11", "windows 11 prebuilt",
];

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

function titleMatches(title: string, query: string): boolean {
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const t = norm(title);
  const words = norm(query).split(" ").filter((w) => w.length > 1);
  return words.every((w) => t.includes(w));
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
      // Filter out accessories
      const normTitle = title.toLowerCase();
      if (ACCESSORY_KEYWORDS.some((kw) => normTitle.includes(kw))) return;
      // Filter out complete systems for GPU searches
      if (product.category === "gpu" && SYSTEM_KEYWORDS.some((kw) => normTitle.includes(kw))) return;
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
    await new Promise((r) => setTimeout(r, 600));
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
