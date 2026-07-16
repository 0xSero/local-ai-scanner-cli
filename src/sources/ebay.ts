/**
 * eBay source — multi-region marketplace, HTML scraping.
 *
 * eBay search results (`/sch/i.html?_nkw=QUERY&_sop=15`) are server-rendered.
 * The HTML is AB-tested — eBay rotates between two card markups, so the parser
 * handles both:
 *
 *   Variant A — `li.su-item-card` / `li.s-item-card`:
 *     Title: `span[role="heading"]` inside `.su-item-card__title` / `.s-item__title`
 *     Price: `span.su-item-card__price` / `span.s-item__price`
 *
 *   Variant B — `div.s-card`:
 *     Title: `span[role="heading"]` inside `.s-card__title`
 *     Price: `span.s-card__price`
 *
 * eBay requires a full Chrome fingerprint (sec-ch-ua, sec-fetch-* headers) —
 * a thin UA-only request gets 403. The shared `fetchText` helper sends those.
 *
 * Country sites:
 *   US → ebay.com     (USD)
 *   DE → ebay.de      (EUR)
 *   GB → ebay.co.uk   (GBP)
 *   PL → ebay.pl      (PLN)
 *
 * eBay Japan redirects to a 404 portal (no /sch/ search), so JP is not covered.
 * Quantity/inventory is not exposed in search results — only on item pages.
 * We parse "X sold" / "X watchers" from the card attributes where available.
 */
import * as cheerio from "cheerio";
import type { Condition, PriceListing, Product, SourceError } from "../types.js";
import type { Source, SourceResult } from "../source.js";
import { fetchText, fetchError } from "../http.js";
import { regionOf } from "../regions.js";
import { queryFor } from "../products.js";

const DOMAINS: Record<string, string> = {
  US: "ebay.com",
  DE: "ebay.de",
  GB: "ebay.co.uk",
  PL: "ebay.pl",
};

/** Map eBay condition strings to our Condition type. */
function mapCondition(text: string): Condition {
  const t = text.toLowerCase();
  if (t.includes("refurbished")) return "refurbished";
  if (t.includes("pre-owned") || t.includes("used")) return "used";
  return "new";
}

/** Parse a localized price string. Handles US ($1,599.99), EU (EUR 1.599,99),
 *  GB (£1,311.39), PL (8 950,00 zł). */
function parsePrice(text: string): number | null {
  const cleaned = text.replace(/[^\d.,\s]/g, "").trim();
  if (!cleaned) return null;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    // Both separators present: the rightmost is the decimal separator
    if (cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
      return parseFloat(cleaned.replace(/\./g, "").replace(",", "."));
    }
    return parseFloat(cleaned.replace(/,/g, ""));
  }
  if (cleaned.includes(",")) {
    const parts = cleaned.split(",");
    if (parts[parts.length - 1].length === 2) {
      return parseFloat(cleaned.replace(/\s/g, "").replace(/\./g, "").replace(",", "."));
    }
    return parseFloat(cleaned.replace(/,/g, ""));
  }
  if (cleaned.includes(" ")) {
    // Space-separated thousands (e.g. "8 950")
    return parseFloat(cleaned.replace(/\s/g, ""));
  }
  return parseFloat(cleaned);
}

/** Parse "X sold" or "X watchers" from card attribute text. */
function parseQuantity(text: string): number | null {
  const m = text.match(/(\d[\d,\s]*)\s*(?:sold|available|watchers)/i);
  if (!m) return null;
  return parseInt(m[1].replace(/[\s,]/g, ""), 10);
}

function isCaptcha(html: string): boolean {
  return /captcha|verify it's you|robot check/i.test(html);
}

function titleMatches(title: string, query: string): boolean {
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const t = norm(title);
  const words = norm(query).split(" ").filter((w) => w.length > 1);
  return words.every((w) => t.includes(w));
}

/** Accessory keywords — listings that match the search terms but aren't the product. */
const ACCESSORY_KEYWORDS = [
  "cable", "adapter", "bracket", "riser", "extension", "connector",
  "fan", "cooler", "thermal", "pad", "holder", "stand", "mount",
  "screw", "washer", "cord", "wire", "case fan", "power supply",
  "bracket kit", "support", "anti-sag", "water block", "waterblock",
  "backplate", "deshroud", "replacement", "repair", "sticker",
  "keycap", "mousepad", "poster", "shirt", "mug", "dock", "hub",
];

/**
 * Extract listings from eBay search HTML, handling both card variants.
 * Uses structural selectors (data-listingid, role="heading", price spans)
 * rather than obfuscated class names.
 */
function extractListings(
  $: cheerio.CheerioAPI,
  product: Product,
  query: string,
  region: ReturnType<typeof regionOf>,
  now: string,
  url: string,
): PriceListing[] {
  const out: PriceListing[] = [];
  let matched = 0;

  // Selectors that match both variants: any element with data-listingid
  // that contains a heading and a price span.
  const cards = $(
    "[data-listingid], li.s-item, li.su-item-card, div.s-card"
  ).toArray();

  for (const el of cards) {
    if (matched >= 10) break;
    const $el = $(el);

    // Title: look for role="heading" span, then fall back to .s-item__title
    let title = $el.find('span[role="heading"]').first().text().trim();
    if (!title) title = $el.find(".s-item__title, .su-item-card__title, .s-card__title").first().text().trim();
    // eBay inserts a "Shop on eBay" placeholder as the first card
    if (!title || title.toLowerCase().includes("shop on ebay")) continue;
    if (!titleMatches(title, query)) return out.length > 0 ? out : out;
    const normTitle = title.toLowerCase();
    if (ACCESSORY_KEYWORDS.some((kw) => normTitle.includes(kw))) continue;

    // Price: try all known price span selectors
    const priceText =
      $el.find(".s-item__price, .su-item-card__price, .s-card__price").first().text().trim();
    // Skip price ranges ("$1,599.99 to $2,499.99") — take the first number
    const firstPrice = priceText.split(/\s+to\s+/i)[0];
    const price = parsePrice(firstPrice);
    if (price === null || price <= 0) continue;

    // Condition: look in subtitle/secondary spans
    const condText = $el
      .find(".s-item__condition, .s-item__subtitle, .su-item-card__subtitle, .s-card__subtitle, .s-card__attribute-row")
      .first()
      .text()
      .trim();
    const condition = condText ? mapCondition(condText) : "new";

    // Link: first anchor with an href containing /itm/
    const link =
      $el.find('a[href*="/itm/"]').first().attr("href") ??
      $el.find("a").first().attr("href") ??
      url;

    // Quantity: parse from attribute containers
    const attrText = $el.find(".su-card-container__attributes, .s-card__attribute-row, .s-item__additionalHotness").text();
    const quantity = parseQuantity(attrText);

    out.push({
      productId: product.id,
      productName: product.name,
      category: product.category,
      retailer: "ebay",
      region,
      condition,
      price,
      currency: region.currency,
      url: link,
      inStock: true,
      quantity,
      fetchedAt: now,
    });
    matched++;
  }
  return out;
}

async function scanEbay(
  products: Product[],
  regionCode: string,
): Promise<SourceResult> {
  const domain = DOMAINS[regionCode];
  if (!domain) return { listings: [], errors: [] };
  const region = regionOf(regionCode);
  const listings: PriceListing[] = [];
  const errors: SourceError[] = [];
  const now = new Date().toISOString();

  for (const product of products) {
    const query = queryFor(product, "ebay");
    const url = `https://www.${domain}/sch/i.html?_nkw=${encodeURIComponent(query)}&_sop=15`;
    const res = await fetchText(url);
    if (!res.ok) {
      errors.push(fetchError("ebay", regionCode, res));
      continue;
    }
    if (isCaptcha(res.body)) {
      errors.push({ retailer: "ebay", region: regionCode, message: "captcha/bot-detection page returned" });
      continue;
    }
    const $ = cheerio.load(res.body);
    listings.push(...extractListings($, product, query, region, now, url));
    await new Promise((r) => setTimeout(r, 500));
  }

  return { listings, errors };
}

export const ebaySource: Source = {
  id: "ebay",
  name: "eBay",
  regions: ["US", "DE", "GB", "PL"],
  categories: ["gpu", "apple", "memory", "amd"],
  scan: (products, ctx) => scanEbay(products, ctx.regionCode),
};
