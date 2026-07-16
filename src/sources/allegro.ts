/**
 * Allegro source — Poland's largest marketplace (PLN), HTML scraping.
 *
 * Allegro search results (`/listing/webapi?string=QUERY&order=m`) are
 * server-rendered with article cards. Each card has:
 *   `h2` → title (with the product name)
 *   `[data-role="regular-price"]` or `.mli7g_2` → price ("4 779,00 zł")
 *   `a` → listing URL
 *
 * Allegro is in Polish. Prices use Polish format: space = thousands,
 * comma = decimal. The złoty symbol may be "zł" or "PLN".
 *
 * Allegro's HTML is heavily class-obfuscated (hashed class names that change
 * between deploys), so we rely on structural selectors (article tags, h2
 * headings, price spans with data-role attributes) rather than stable class
 * names. If the obfuscated classes change, the structural fallbacks still work.
 *
 * Anti-bot: Allegro occasionally returns a captcha/JS challenge. We detect it
 * and record an error. No JS rendering needed for the search results page —
 * the server returns the full listing HTML.
 */
import * as cheerio from "cheerio";
import type { Condition, PriceListing, Product, SourceError } from "../types.js";
import type { Source, SourceResult } from "../source.js";
import { fetchText, fetchError } from "../http.js";
import { regionOf } from "../regions.js";
import { queryFor } from "../products.js";

const SEARCH_URL = "https://allegro.pl/listing/webapi";

/** Parse a Polish-format price like "4 779,00 zł" → 4779.00 */
function parsePolishPrice(text: string): number | null {
  // Remove currency symbols and non-numeric chars except space, comma, dot
  const cleaned = text.replace(/[^0-9.,\s]/g, "").trim();
  if (!cleaned) return null;
  // Polish: space = thousands, comma = decimal
  return parseFloat(cleaned.replace(/\s/g, "").replace(/\./g, "").replace(",", "."));
}

/** Map Allegro condition text to our Condition type. */
function mapCondition(text: string): Condition {
  const t = text.toLowerCase();
  if (t.includes("używ") || t.includes("used")) return "used";
  if (t.includes("odnow") || t.includes("refurb")) return "refurbished";
  return "new";
}

function isCaptcha(html: string): boolean {
  return /captcha|weryfikuj|robot|challenge/i.test(html);
}

function titleMatches(title: string, query: string): boolean {
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const t = norm(title);
  const words = norm(query).split(" ").filter((w) => w.length > 1);
  return words.every((w) => t.includes(w));
}

/** Accessory keywords in English (most electronics listings use English model names). */
const ACCESSORY_KEYWORDS = [
  "cable", "adapter", "bracket", "riser", "extension", "connector",
  "fan", "cooler", "thermal", "pad", "holder", "stand", "mount",
  "screw", "washer", "cord", "wire", "power supply",
  "water block", "waterblock", "backplate", "deshroud", "sticker",
];

async function scanAllegro(
  products: Product[],
  regionCode: string,
): Promise<SourceResult> {
  if (regionCode !== "PL") return { listings: [], errors: [] };
  const region = regionOf(regionCode);
  const listings: PriceListing[] = [];
  const errors: SourceError[] = [];
  const now = new Date().toISOString();

  for (const product of products) {
    const query = queryFor(product, "allegro");
    const url = `${SEARCH_URL}?string=${encodeURIComponent(query)}&order=m`;
    const res = await fetchText(url);
    if (!res.ok) {
      errors.push(fetchError("allegro", regionCode, res));
      continue;
    }
    if (isCaptcha(res.body)) {
      errors.push({ retailer: "allegro", region: regionCode, message: "captcha/bot-detection page returned" });
      continue;
    }
    const $ = cheerio.load(res.body);
    let matched = 0;
    // Allegro renders listings as <article> or divs inside search results.
    // The structure is class-obfuscated, so we look for elements containing
    // both a price and a link/h2 title.
    $("article, section article, div[data-role='offer']").each((_, el) => {
      if (matched >= 10) return;
      const $el = $(el);
      const title = $el.find("h2").first().text().trim();
      if (!title || !titleMatches(title, query)) return;
      const normTitle = title.toLowerCase();
      if (ACCESSORY_KEYWORDS.some((kw) => normTitle.includes(kw))) return;
      // Try multiple price selectors — Allegro's obfuscated classes change
      const priceText =
        $el.find("[data-role='regular-price']").first().text().trim() ||
        $el.find("[data-role='price']").first().text().trim() ||
        $el.find("span:contains('zł')").first().text().trim();
      const price = parsePolishPrice(priceText);
      if (price === null || price <= 0) return;
      const link = $el.find("a").first().attr("href") ?? url;
      // Condition is often in a small subtitle span
      const condText = $el.find("span:contains('używ'), span:contains('odnow'), span:contains('now')").first().text().trim();
      const condition = condText ? mapCondition(condText) : "new";
      listings.push({
        productId: product.id,
        productName: product.name,
        category: product.category,
        retailer: "allegro",
        region,
        condition,
        price,
        currency: region.currency,
        url: link.startsWith("http") ? link : `https://allegro.pl${link}`,
        inStock: true,
        quantity: null,
        fetchedAt: now,
      });
      matched++;
    });
    await new Promise((r) => setTimeout(r, 600));
  }

  return { listings, errors };
}

export const allegroSource: Source = {
  id: "allegro",
  name: "Allegro",
  regions: ["PL"],
  categories: ["gpu", "apple", "memory", "amd"],
  scan: (products, ctx) => scanAllegro(products, ctx.regionCode),
};
