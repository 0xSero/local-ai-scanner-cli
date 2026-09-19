/**
 * Alternate.de source — German retailer (EUR), server-rendered HTML.
 *
 * The listing page (`/listing.xhtml?q=QUERY`) returns Bootstrap-styled HTML
 * with `.productBox` cards. Each card has a `.product-name` span holding the
 * listing title, a link whose href contains the product slug + `/html/product/ID`,
 * and a `.price` span with the German-formatted price ("€ 4.779,00"). No
 * anti-bot; plain HTTP GET with a desktop UA.
 *
 * German price format: dot = thousands, comma = decimal. We parse by stripping
 * the € symbol, removing thousand dots, and replacing the decimal comma.
 */
import * as cheerio from "cheerio";
import type { PriceListing, Product, SourceError } from "../types.js";
import type { Source, SourceResult } from "../source.js";
import { fetchText, fetchError, sleep } from "../http.js";
import { regionOf } from "../regions.js";
import { queryFor } from "../products.js";
import { titleMatches, isAccessoryListing, isSystemListing } from "./listing-match.js";

const SEARCH_URL = "https://www.alternate.de/listing.xhtml?q=";

/** Parse a German-format price like "€ 4.779,00" → 4779.00 */
function parseGermanPrice(text: string): number | null {
  const cleaned = text.replace(/[^0-9.,]/g, "").trim();
  if (!cleaned) return null;
  // German: dot=thousands, comma=decimal
  return parseFloat(cleaned.replace(/\./g, "").replace(",", "."));
}

/**
 * Parse stock from the card's availability line. Alternate labels an available
 * product "Sofort verfügbar" ("available immediately"), not "Auf Lager", so
 * testing only for the latter marked every listing out of stock.
 */
function parseStock(text: string): boolean {
  if (/nicht\s+verfügbar|ausverkauft|nicht\s+auf\s*lager/i.test(text)) return false;
  return /sofort\s+verfügbar|verfügbar|auf\s*lager|lieferbar/i.test(text);
}

/**
 * Parse the product cards on a listing page into listings for one product.
 *
 * The card's `.product-name` span holds the listing title, which is what the
 * accessory and system filters inspect; a card's full text also carries the
 * technical description, which names coolers and backplates for real cards.
 */
function parseCards(
  body: string,
  product: Product,
  query: string,
  regionCode: string,
  now: string,
): PriceListing[] {
  const $ = cheerio.load(body);
  const region = regionOf(regionCode);
  const listings: PriceListing[] = [];

  $(".productBox").each((_, el) => {
    if (listings.length >= 8) return;
    const $el = $(el);
    const href = $el.find("a").first().attr("href") ?? "";
    const priceText = $el.find(".price").first().text().trim();
    const price = parseGermanPrice(priceText);
    if (price === null || price <= 0) return;
    // Match using the href slug + card text against the query
    const cardText = $el.text();
    if (!titleMatches(cardText + " " + href, query)) return;
    const title = $el.find(".product-name").first().text().trim() || cardText;
    // A card's name appears in the title of its water block and its cable
    if (isAccessoryListing(title)) return;
    // Alternate also lists whole machines that contain the card
    if (isSystemListing(title, product.category)) return;
    // Parse stock: "Sofort verfügbar" = in stock, other availability text = not
    const stockText = $el.find("[style*='availability']").first().text().trim();
    listings.push({
      productId: product.id,
      productName: product.name,
      category: product.category,
      retailer: "alternate",
      region,
      condition: "new",
      price,
      currency: region.currency,
      url: href.startsWith("http") ? href : `https://www.alternate.de${href}`,
      inStock: parseStock(stockText),
      quantity: null,
      fetchedAt: now,
    });
  });

  return listings;
}

async function scanAlternate(
  products: Product[],
  regionCode: string,
): Promise<SourceResult> {
  const listings: PriceListing[] = [];
  const errors: SourceError[] = [];
  const now = new Date().toISOString();

  for (const product of products) {
    const query = queryFor(product, "alternate");
    const url = `${SEARCH_URL}${encodeURIComponent(query)}`;
    let res = await fetchText(url);
    let retried = false;
    if (!res.ok && res.status === 429) {
      // 429 = rate limited. Wait longer and retry once before giving up.
      retried = true;
      await sleep(3000);
      res = await fetchText(url);
    }
    if (!res.ok) {
      errors.push(fetchError("alternate", regionCode, res));
      continue;
    }
    listings.push(...parseCards(res.body, product, query, regionCode, now));
    await sleep(retried ? 1500 : 1200);
  }

  return { listings, errors };
}

export const alternateSource: Source = {
  id: "alternate",
  name: "Alternate.de",
  regions: ["DE"],
  categories: ["gpu", "memory", "laptop"],
  scan: (products, ctx) => scanAlternate(products, ctx.regionCode),
};
