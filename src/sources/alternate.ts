/**
 * Alternate.de source — German retailer (EUR), server-rendered HTML.
 *
 * The listing page (`/listing.xhtml?q=QUERY`) returns Bootstrap-styled HTML
 * with `.productBox` cards. Each card has a link whose href contains the
 * product slug + `/html/product/ID`, a `.product-name.font-weight-bold` span
 * with the brand, and a `.price` span with the German-formatted price
 * ("€ 4.779,00"). No anti-bot; plain HTTP GET with a desktop UA.
 *
 * German price format: dot = thousands, comma = decimal. We parse by stripping
 * the € symbol, removing thousand dots, and replacing the decimal comma.
 */
import * as cheerio from "cheerio";
import type { PriceListing, Product, SourceError } from "../types.js";
import type { Source, SourceResult } from "../source.js";
import { fetchText, fetchError } from "../http.js";
import { regionOf } from "../regions.js";
import { queryFor } from "../products.js";

const SEARCH_URL = "https://www.alternate.de/listing.xhtml?q=";

/** Parse a German-format price like "€ 4.779,00" → 4779.00 */
function parseGermanPrice(text: string): number | null {
  const cleaned = text.replace(/[^0-9.,]/g, "").trim();
  if (!cleaned) return null;
  // German: dot=thousands, comma=decimal
  return parseFloat(cleaned.replace(/\./g, "").replace(",", "."));
}

function titleMatches(text: string, query: string): boolean {
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const t = norm(text);
  const words = norm(query).split(" ").filter((w) => w.length > 1);
  return words.every((w) => t.includes(w));
}

async function scanAlternate(
  products: Product[],
  regionCode: string,
): Promise<SourceResult> {
  const region = regionOf(regionCode);
  const listings: PriceListing[] = [];
  const errors: SourceError[] = [];
  const now = new Date().toISOString();

  for (const product of products) {
    const query = queryFor(product, "alternate");
    const url = `${SEARCH_URL}${encodeURIComponent(query)}`;
    const res = await fetchText(url);
    if (!res.ok) {
      // 429 = rate limited. Wait longer and retry once before giving up.
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 3000));
        const retry = await fetchText(url);
        if (!retry.ok) {
          errors.push(fetchError("alternate", regionCode, retry));
          continue;
        }
        const $ = cheerio.load(retry.body);
        // ... fall through to parsing below
        let matched2 = 0;
        $(".productBox").each((_, el) => {
          if (matched2 >= 8) return;
          const $el = $(el);
          const href = $el.find("a").first().attr("href") ?? "";
          const priceText = $el.find(".price").first().text().trim();
          const price = parseGermanPrice(priceText);
          if (price === null || price <= 0) return;
          const cardText = $el.text();
          if (!titleMatches(cardText + " " + href, query)) return;
          const stockText = $el.find("[style*='availability']").first().text().trim();
          const inStock = /auf\s*lager/i.test(stockText);
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
            inStock,
            quantity: null,
            fetchedAt: now,
          });
          matched2++;
        });
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      errors.push(fetchError("alternate", regionCode, res));
      continue;
    }
    const $ = cheerio.load(res.body);
    let matched = 0;
    $(".productBox").each((_, el) => {
      if (matched >= 8) return;
      const $el = $(el);
      const href = $el.find("a").first().attr("href") ?? "";
      const priceText = $el.find(".price").first().text().trim();
      const price = parseGermanPrice(priceText);
      if (price === null || price <= 0) return;
      // Match using the href slug + card text against the query
      const cardText = $el.text();
      if (!titleMatches(cardText + " " + href, query)) return;
      // Parse stock: "Auf Lager" = in stock, other availability text = not
      const stockText = $el.find("[style*='availability']").first().text().trim();
      const inStock = /auf\s*lager/i.test(stockText);
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
        inStock,
        quantity: null,
        fetchedAt: now,
      });
      matched++;
    });
    await new Promise((r) => setTimeout(r, 1200));
  }

  return { listings, errors };
}

export const alternateSource: Source = {
  id: "alternate",
  name: "Alternate.de",
  regions: ["DE"],
  categories: ["gpu", "memory"],
  scan: (products, ctx) => scanAlternate(products, ctx.regionCode),
};
