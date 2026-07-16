/**
 * Ceneo.pl source — Poland's largest price comparison aggregator (PLN).
 *
 * Ceneo's search page (`/Komputery;szukaj-QUERY`) returns server-rendered HTML
 * with embedded JSON-LD structured data. Each `<script type="application/ld+json">`
 * contains an `ItemList` whose `itemListElement[]` entries hold `Product` objects
 * with `name` and `offers` (`AggregateOffer` with `lowPrice`, `offerCount`,
 * `priceCurrency: "PLN"`).
 *
 * As a price aggregator, Ceneo shows offers from multiple shops — each product
 * entry's `offerCount` tells how many shops carry it, and `lowPrice` is the
 * cheapest. We use the `offerCount` as the quantity proxy (number of shops
 * offering the product), which is a meaningful availability signal.
 *
 * No anti-bot; plain HTTP GET with a desktop UA. Ceneo is one of the few major
 * Polish e-commerce sites that doesn't block server-side fetching.
 */
import * as cheerio from "cheerio";
import type { PriceListing, Product, SourceError } from "../types.js";
import type { Source, SourceResult } from "../source.js";
import { fetchText, fetchError } from "../http.js";
import { regionOf } from "../regions.js";
import { queryFor } from "../products.js";

const SEARCH_URL = "https://www.ceneo.pl/Komputery;szukaj-";

/** Accessory keywords — listings that match the query but aren't the product. */
const ACCESSORY_KEYWORDS = [
  "cable", "adapter", "bracket", "riser", "extension", "connector",
  "fan", "cooler", "thermal", "pad", "holder", "stand", "mount",
  "screw", "washer", "cord", "wire", "case fan", "power supply",
  "water block", "waterblock", "backplate", "deshroud", "replacement",
  "repair", "sticker", "alphacool", "phanteks", "barrow", "bykski",
];

/**
 * Keywords that indicate a listing is a complete system (laptop, pre-built PC)
 * rather than a standalone component. Ceneo indexes laptops that contain the GPU.
 */
const SYSTEM_KEYWORDS = [
  "laptop", "desktop", "workstation", "server", "prebuilt", "pre-built",
  "tower", "gaming pc", "pc build", "system", "notebook",
];

/**
 * Minimum price per category (PLN). Filters accessories and low-end parts.
 */
const MIN_PRICE: Record<string, number> = {
  gpu: 600,
  apple: 1600,
  memory: 120,
  amd: 2000,
};

/** Rough USD → PLN conversion for per-product price floors. */
const USD_TO_PLN = 4.0;

/** Maximum price multiplier — rejects complete systems masquerading as parts. */
const MAX_PRICE_MULTIPLIER = 4;

function parsePolishPrice(text: string): number | null {
  // Polish format: "3699,0" or "1 299,99" — comma = decimal, space = thousands
  const cleaned = text.replace(/[^\d.,]/g, "").trim();
  if (!cleaned) return null;
  return parseFloat(cleaned.replace(/\./g, "").replace(",", "."));
}

function titleMatches(title: string, query: string): boolean {
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const t = norm(title);
  const words = norm(query).split(" ").filter((w) => w.length > 1);
  return words.every((w) => t.includes(w));
}

interface CeneoProduct {
  name: string;
  lowPrice: number;
  offerCount: number;
  url: string;
}

/** Extract products from Ceneo's JSON-LD ItemList. */
function parseJsonLd(html: string): CeneoProduct[] {
  const $ = cheerio.load(html);
  const products: CeneoProduct[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    const text = $(el).html() ?? "";
    try {
      const data = JSON.parse(text);
      const items = data.itemListElement ?? (Array.isArray(data) ? data : []);
      for (const item of items) {
        const product = item.item ?? item;
        if (!product?.name || product["@type"] !== "Product") continue;
        const offers = product.offers;
        if (!offers) continue;
        const lowPrice = typeof offers.lowPrice === "number"
          ? offers.lowPrice
          : parsePolishPrice(String(offers.lowPrice ?? ""));
        if (lowPrice === null || lowPrice <= 0) continue;
        products.push({
          name: product.name,
          lowPrice,
          offerCount: offers.offerCount ?? 1,
          url: product.url ?? "",
        });
      }
    } catch {
      // Malformed JSON-LD — skip
    }
  });

  return products;
}

async function scanCeneo(
  products: Product[],
  regionCode: string,
): Promise<SourceResult> {
  const region = regionOf(regionCode);
  const listings: PriceListing[] = [];
  const errors: SourceError[] = [];
  const now = new Date().toISOString();

  for (const product of products) {
    const query = queryFor(product, "ceneo");
    const url = `${SEARCH_URL}${encodeURIComponent(query)}`;
    const res = await fetchText(url);
    if (!res.ok) {
      errors.push(fetchError("ceneo", regionCode, res));
      continue;
    }
    const ceneoProducts = parseJsonLd(res.body);
    if (ceneoProducts.length === 0) {
      errors.push({ retailer: "ceneo", region: regionCode, message: "no JSON-LD products parsed" });
      continue;
    }

    let matched = 0;
    const catFloor = MIN_PRICE[product.category] ?? 0;
    const productFloor = product.minPriceUsd
      ? product.minPriceUsd * USD_TO_PLN
      : 0;
    const minPrice = Math.max(catFloor, productFloor);
    const maxPrice = product.minPriceUsd
      ? product.minPriceUsd * MAX_PRICE_MULTIPLIER * USD_TO_PLN
      : Infinity;

    for (const cp of ceneoProducts) {
      if (matched >= 8) break;
      if (!titleMatches(cp.name, query)) continue;
      // Filter out accessories
      const normName = cp.name.toLowerCase();
      if (ACCESSORY_KEYWORDS.some((kw) => normName.includes(kw))) continue;
      // Filter out complete systems for GPU searches
      if (product.category === "gpu" && SYSTEM_KEYWORDS.some((kw) => normName.includes(kw))) continue;
      if (cp.lowPrice < minPrice || cp.lowPrice > maxPrice) continue;

      listings.push({
        productId: product.id,
        productName: product.name,
        category: product.category,
        retailer: "ceneo",
        region,
        condition: "new",
        price: cp.lowPrice,
        currency: region.currency,
        url: cp.url || `https://www.ceneo.pl/szukaj-${encodeURIComponent(query)}`,
        inStock: cp.offerCount > 0,
        // offerCount = number of shops offering this product — a meaningful
        // availability signal even though it's not a unit count
        quantity: cp.offerCount > 0 ? cp.offerCount : null,
        fetchedAt: now,
      });
      matched++;
    }
    await new Promise((r) => setTimeout(r, 600));
  }

  return { listings, errors };
}

export const ceneoSource: Source = {
  id: "ceneo",
  name: "Ceneo",
  regions: ["PL"],
  categories: ["gpu", "apple", "memory", "amd"],
  scan: (products, ctx) => scanCeneo(products, ctx.regionCode),
};
