/**
 * Amazon source — multi-region, HTML scraping.
 *
 * Amazon returns server-rendered HTML at `/{domain}/s?k=QUERY`. Each result is
 * a `data-component-type="s-search-result"` block with `data-asin`. The price
 * is in `<span class="a-offscreen">$X,XXX.XX</span>`. The title is in the h2
 * inside the block.
 *
 * Amazon has soft anti-bot — it usually works with a desktop UA but can
 * intermittently return a captcha page. We detect that and record an error
 * rather than emitting bogus listings.
 *
 * Country domains:
 *   US → amazon.com    (USD)
 *   DE → amazon.de     (EUR)
 *   GB → amazon.co.uk  (GBP)
 *   JP → amazon.co.jp  (JPY)
 */
import * as cheerio from "cheerio";
import type { PriceListing, Product, SourceError } from "../types.js";
import type { Source, SourceResult } from "../source.js";
import { fetchText, fetchError } from "../http.js";
import { regionOf } from "../regions.js";
import { queryFor } from "../products.js";

const DOMAINS: Record<string, string> = {
  US: "amazon.com",
  DE: "amazon.de",
  GB: "amazon.co.uk",
  JP: "amazon.co.jp",
  PL: "amazon.pl",
};

/**
 * Minimum price per category per currency — Amazon search results include
 * accessories (cables, adapters, brackets) whose titles contain the GPU/model
 * name but cost a fraction of the real product. These thresholds filter them
 * out. Thresholds are calibrated per currency so a ¥700 cable doesn't slip
 * past a $400 threshold.
 */
const MIN_PRICE: Record<string, Record<string, number>> = {
  USD: { gpu: 150, apple: 400, memory: 30, amd: 500 },
  EUR: { gpu: 140, apple: 380, memory: 25, amd: 450 },
  GBP: { gpu: 120, apple: 320, memory: 22, amd: 400 },
  JPY: { gpu: 20000, apple: 60000, memory: 4000, amd: 75000 },
  PLN: { gpu: 600, apple: 1600, memory: 120, amd: 2000 },
};

/**
 * Rough USD → local currency conversion for per-product price floors.
 * Not used for price display — only to translate `product.minPriceUsd` into
 * the listing currency so we can reject accessories in non-US regions.
 */
const USD_TO: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 155,
  PLN: 4.0,
};

/** Accessory keywords that indicate a listing is NOT the actual product. */
const ACCESSORY_KEYWORDS = [
  "cable", "adapter", "bracket", "riser", "extension", "connector",
  "fan", "cooler", "thermal", "pad", "holder", "stand", "mount",
  "screw", "washer", "cord", "wire", "case fan", "power supply",
  "bracket kit", "support", "anti-sag", "water block", "waterblock",
  "backplate", "deshroud", "replacement", "repair", "decals", "sticker",
  "keycap", "mousepad", "poster", "shirt", "mug",
];

/**
 * Keywords that indicate a listing is a complete system (pre-built PC,
 * workstation, server) rather than a standalone component. Applied to GPU
 * searches where a $60K "RTX Pro 6000" result is actually a workstation that
 * contains the card.
 */
const SYSTEM_KEYWORDS = [
  "desktop", "workstation", "server", "prebuilt", "pre-built",
  "tower", "barebone", "gaming pc", "pc build", "system",
  "configured", "bundle",
];

/**
 * Maximum price multiplier — a listing above `minPriceUsd * multiplier` is
 * almost certainly a complete system or extreme markup, not a standalone part.
 */
const MAX_PRICE_MULTIPLIER = 4;

/** Parse a localized price string like "$4,999.99", "4.779,00 €", "¥419,800". */
function parsePrice(text: string): number | null {
  // Strip currency symbols and letters, keep digits, separators
  const cleaned = text.replace(/[^\d.,]/g, "").trim();
  if (!cleaned) return null;
  // Detect format: if comma is the decimal separator (European), swap
  if (cleaned.includes(",") && cleaned.includes(".")) {
    // Both present: last one is the decimal separator
    if (cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
      // European: 4.779,00 → remove dots, comma→dot
      return parseFloat(cleaned.replace(/\./g, "").replace(",", "."));
    }
    // US: 4,999.99 → remove commas
    return parseFloat(cleaned.replace(/,/g, ""));
  }
  if (cleaned.includes(",")) {
    // Only comma: could be European decimal (4.779,00 already handled above)
    // or US thousands (4,999). If 2 digits after last comma, treat as decimal.
    const parts = cleaned.split(",");
    if (parts[parts.length - 1].length === 2) {
      return parseFloat(cleaned.replace(/\./g, "").replace(",", "."));
    }
    return parseFloat(cleaned.replace(/,/g, ""));
  }
  return parseFloat(cleaned);
}

function isCaptcha(html: string): boolean {
  return /api-services-support@amazon|Type the characters|captcha/i.test(html);
}

function titleMatches(title: string, query: string): boolean {
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const t = norm(title);
  const words = norm(query).split(" ").filter((w) => w.length > 1);
  return words.every((w) => t.includes(w));
}

/**
 * Parse stock quantity from an Amazon product detail page.
 *
 * Amazon detail pages contain availability text like:
 *   "Only 13 left in stock - order soon"  → quantity 13
 *   "In Stock"                             → quantity null (available, count unknown)
 *   "Temporarily out of stock"             → quantity 0, inStock false
 *   "Only 2 left in stock"                 → quantity 2
 *
 * Returns { quantity, inStock } — both null if the page didn't parse.
 */
function parseStockFromDetail(html: string): { quantity: number | null; inStock: boolean | null } {
  // "Only X left in stock" — explicit count
  const onlyLeft = html.match(/only\s+(\d+)\s+(?:left|remaining)/i);
  if (onlyLeft) {
    return { quantity: parseInt(onlyLeft[1], 10), inStock: true };
  }
  // "In Stock" without a count
  if (/in\s*stock/i.test(html) && !/out\s*of\s*stock/i.test(html)) {
    return { quantity: null, inStock: true };
  }
  // "Out of stock" / "Temporarily out of stock"
  if (/out\s*of\s*stock|temporarily\s*out|unavailable/i.test(html)) {
    return { quantity: 0, inStock: false };
  }
  return { quantity: null, inStock: null };
}

/**
 * Fetch detail pages for the cheapest listings to populate stock/quantity.
 * Caps at `maxFetches` detail-page requests per product to keep the scan bounded.
 */
async function enrichWithStock(
  listings: PriceListing[],
  maxFetches: number,
  cookies?: string,
): Promise<void> {
  // Sort by price ascending and take the cheapest ones with ASIN URLs
  const candidates = listings
    .filter((l) => l.url.includes("/dp/"))
    .sort((a, b) => a.price - b.price)
    .slice(0, maxFetches);

  for (const listing of candidates) {
    const res = await fetchText(listing.url, cookies ? { cookies } : undefined);
    if (!res.ok) continue;
    const { quantity, inStock } = parseStockFromDetail(res.body);
    listing.quantity = quantity;
    if (inStock !== null) listing.inStock = inStock;
    await new Promise((r) => setTimeout(r, 300));
  }
}

/**
 * Amazon GB (amazon.co.uk) gates search behind an AWS WAF challenge that
 * requires a session cookie. We send a minimal cookie header that satisfies
 * the WAF and keeps the response in GBP. Other regions don't need cookies.
 */
const REGION_COOKIES: Record<string, string> = {
  US: "session-id=260-1234567-1234567; session-id-time=1234567890l; i18n-prefs=USD; lc-main=en_US",
  DE: "session-id=260-1234567-1234567; session-id-time=1234567890l; i18n-prefs=EUR; lc-main=de_DE",
  GB: "session-id=260-1234567-1234567; session-id-time=1234567890l; i18n-prefs=GBP; lc-main=en_GB",
  JP: "session-id=260-1234567-1234567; session-id-time=1234567890l; i18n-prefs=JPY; lc-main=ja_JP",
  PL: "session-id=260-1234567-1234567; session-id-time=1234567890l; i18n-prefs=PLN; lc-main=pl_PL",
};

async function scanAmazon(
  products: Product[],
  regionCode: string,
): Promise<SourceResult> {
  const domain = DOMAINS[regionCode];
  if (!domain) return { listings: [], errors: [] };
  const region = regionOf(regionCode);
  const listings: PriceListing[] = [];
  const errors: SourceError[] = [];
  const now = new Date().toISOString();
  const cookies = REGION_COOKIES[regionCode];

  for (const product of products) {
    const query = queryFor(product, "amazon");
    const url = `https://www.${domain}/s?k=${encodeURIComponent(query)}&s=price-asc-rank`;
    let res = await fetchText(url, cookies ? { cookies } : undefined);

    // Amazon intermittently returns a small anti-bot challenge page (Akamai
    // interstitial with "bm-verify", or a 503 rate-limit). Both are transient
    // — retrying after a short delay usually gets the real search page. We
    // retry up to twice: once for 503, once for the challenge page.
    let challengeDetected = false;
    if (res.status === 503) {
      await new Promise((r) => setTimeout(r, 2000));
      res = await fetchText(url, cookies ? { cookies } : undefined);
    }
    if (res.ok && res.body.length < 5000 && /awswaf|challenge\.js|bm-verify|interstitial|akamai/i.test(res.body)) {
      challengeDetected = true;
      await new Promise((r) => setTimeout(r, 1500));
      res = await fetchText(url, cookies ? { cookies } : undefined);
    }

    if (!res.ok) {
      errors.push(fetchError("amazon", regionCode, res));
      continue;
    }
    if (isCaptcha(res.body)) {
      errors.push({ retailer: "amazon", region: regionCode, message: "captcha/bot-detection page returned" });
      continue;
    }
    // Detect Akamai interstitial challenge page after retry — record error
    if (res.body.length < 5000 && /awswaf|challenge\.js|bm-verify|interstitial|akamai/i.test(res.body)) {
      errors.push({ retailer: "amazon", region: regionCode, message: "anti-bot challenge page (Akamai/AWS WAF)" });
      continue;
    }
    const $ = cheerio.load(res.body);
    let matched = 0;
    const productListings: PriceListing[] = [];
    // Use the higher of: category-level floor or per-product floor (converted
    // to the listing currency). The per-product floor catches high-end GPU
    // accessories (e.g. a $160 RTX 5090 water block passes the $150 GPU floor).
    const catFloor = (MIN_PRICE[region.currency] ?? {})[product.category] ?? 0;
    const productFloor = product.minPriceUsd
      ? product.minPriceUsd * (USD_TO[region.currency] ?? 1)
      : 0;
    const minPrice = Math.max(catFloor, productFloor);
    const maxPrice = product.minPriceUsd
      ? product.minPriceUsd * MAX_PRICE_MULTIPLIER * (USD_TO[region.currency] ?? 1)
      : Infinity;
    $('[data-component-type="s-search-result"]').each((_, el) => {
      if (matched >= 8) return;
      const $el = $(el);
      const asin = $el.attr("data-asin") ?? "";
      const title = $el.find("h2").text().trim();
      if (!titleMatches(title, query)) return;
      // Filter out accessories (cables, brackets, etc.) that contain the
      // search terms but aren't the actual product
      const normTitle = title.toLowerCase();
      if (ACCESSORY_KEYWORDS.some((kw) => normTitle.includes(kw))) return;
      // Filter out complete systems (workstations, pre-builts) that contain
      // the GPU but aren't standalone cards
      if (product.category === "gpu" && SYSTEM_KEYWORDS.some((kw) => normTitle.includes(kw))) return;
      const priceText = $el.find(".a-offscreen").first().text().trim();
      const price = parsePrice(priceText);
      if (price === null || price < minPrice || price > maxPrice) return;
      productListings.push({
        productId: product.id,
        productName: product.name,
        category: product.category,
        retailer: "amazon",
        region,
        condition: "new",
        price,
        currency: region.currency,
        url: asin ? `https://www.${domain}/dp/${asin}` : url,
        inStock: null,
        quantity: null,
        fetchedAt: now,
      });
      matched++;
    });
    // Fetch detail pages for the cheapest listings to parse stock/quantity
    await enrichWithStock(productListings, 3, cookies);
    listings.push(...productListings);
    // Longer delay between products to avoid triggering Akamai rate limits
    await new Promise((r) => setTimeout(r, 800));
  }

  return { listings, errors };
}

export const amazonSource: Source = {
  id: "amazon",
  name: "Amazon",
  regions: ["US", "DE", "GB", "JP", "PL"],
  categories: ["gpu", "apple", "memory", "amd"],
  scan: (products, ctx) => scanAmazon(products, ctx.regionCode),
};
