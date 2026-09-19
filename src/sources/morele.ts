/**
 * Morele.net source — large Polish electronics retailer (PLN).
 *
 * The search page (`/wyszukiwarka/?q=QUERY`) is server-rendered and needs no
 * anti-bot handling with a desktop UA (verified: HTTP 200). Every result is a
 * `.cat-product` card that carries the price and metadata as data attributes:
 *   data-product-name          — full title ("Laptop Dell XPS 16 DA16260 …")
 *   data-product-brand         — manufacturer ("Dell", "Apple", "Asus")
 *   data-product-category-name — Polish category ("Laptopy", "Pamięci RAM", …)
 *   data-product-price         — numeric PLN price, dot decimal ("15163.1")
 * and the product URL is on a child `[data-link-href-param]` element.
 *
 * Morele's search is fuzzy — a laptop query also returns RAM, batteries and
 * pre-built desktops. We keep only cards whose category starts with "Laptop"
 * (so "Laptopy" passes but "Baterie do laptopów" does not) and whose title
 * contains every word of the query. Non-matches become gaps, never listings.
 *
 * Scoped to laptops: Morele also lists GPUs/memory, but its search mixes in
 * complete systems there, so we leave those categories to the existing
 * component-specialist sources rather than risk polluting their stats.
 */
import * as cheerio from "cheerio";
import type { PriceListing, Product, SourceError } from "../types.js";
import type { Source, SourceResult } from "../source.js";
import { fetchText, fetchError } from "../http.js";
import { regionOf } from "../regions.js";
import { queryFor } from "../products.js";
import { titleMatches, isAccessoryListing, isSystemListing } from "./listing-match.js";

const SEARCH_URL = "https://www.morele.net/wyszukiwarka/?q=";

async function scanMorele(
  products: Product[],
  regionCode: string,
): Promise<SourceResult> {
  if (regionCode !== "PL") return { listings: [], errors: [] };
  const region = regionOf(regionCode);
  const listings: PriceListing[] = [];
  const errors: SourceError[] = [];
  const now = new Date().toISOString();

  const laptops = products.filter((p) => p.category === "laptop");

  for (const product of laptops) {
    const query = queryFor(product, "morele");
    const url = `${SEARCH_URL}${encodeURIComponent(query)}`;
    const res = await fetchText(url);
    if (!res.ok) {
      errors.push(fetchError("morele", regionCode, res));
      continue;
    }
    const $ = cheerio.load(res.body);
    let matched = 0;
    $(".cat-product[data-product-price]").each((_, el) => {
      if (matched >= 8) return;
      const $el = $(el);
      const category = $el.attr("data-product-category-name") ?? "";
      // Keep only laptops: "Laptopy" passes, "Baterie do laptopów" does not.
      if (!category.toLowerCase().startsWith("laptop")) return;
      const name = $el.attr("data-product-name") ?? "";
      if (!titleMatches(name, query)) return;
      const price = parseFloat($el.attr("data-product-price") ?? "");
      if (!Number.isFinite(price) || price <= 0) return;
      const href = $el.find("[data-link-href-param]").first().attr("data-link-href-param") ?? "";
      listings.push({
        productId: product.id,
        productName: name || product.name,
        category: product.category,
        retailer: "morele",
        region,
        condition: "new",
        price,
        currency: region.currency,
        url: href.startsWith("http") ? href : `https://www.morele.net${href}`,
        inStock: null,
        quantity: null,
        fetchedAt: now,
      });
      matched++;
    });
    await new Promise((r) => setTimeout(r, 800));
  }

  return { listings, errors };
}

export const moreleSource: Source = {
  id: "morele",
  name: "Morele.net",
  regions: ["PL"],
  categories: ["laptop"],
  scan: (products, ctx) => scanMorele(products, ctx.regionCode),
};
