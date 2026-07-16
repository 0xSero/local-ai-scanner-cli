/**
 * Yodobashi Camera source — Japan's largest electronics retailer (JPY).
 *
 * Yodobashi search results (`/category/.../?word=QUERY`) are server-rendered
 * with `.searchResultItem` blocks. Each block contains:
 *   `.pNameBlock` or `.searchResultName` — product title
 *   `.pPriceBlock` or `.searchResultPrice` — price ("¥299,800")
 *   `.pAvailability` — stock status text ("在庫あり" = in stock)
 *   `a` — product URL
 *
 * Yodobashi has no anti-bot; plain HTTP GET with a desktop UA works. Prices are
 * in JPY (no decimal, comma-separated thousands). Stock text uses Japanese:
 *   "在庫あり" = in stock, "在庫切れ" / "在庫僅少" = low/out of stock.
 *
 * Only Japanese regions are covered. The site is yodobashi.com.
 */
import * as cheerio from "cheerio";
import type { PriceListing, Product, SourceError } from "../types.js";
import type { Source, SourceResult } from "../source.js";
import { fetchText, fetchError } from "../http.js";
import { regionOf } from "../regions.js";
import { queryFor } from "../products.js";

const SEARCH_URL = "https://www.yodobashi.com/";

/** Parse a Japanese-format price like "¥299,800" → 299800 */
function parsePrice(text: string): number | null {
  const cleaned = text.replace(/[^0-9,]/g, "").trim();
  if (!cleaned) return null;
  // JPY: comma = thousands, no decimal
  return parseFloat(cleaned.replace(/,/g, ""));
}

/**
 * Parse stock status from Japanese availability text.
 * "在庫あり" = in stock, "在庫切れ" = out of stock, "在庫僅少" = low stock
 */
function parseStock(text: string): { inStock: boolean | null; quantity: number | null } {
  if (/在庫切れ|out\s*of\s*stock/i.test(text)) return { inStock: false, quantity: 0 };
  if (/在庫僅少/i.test(text)) return { inStock: true, quantity: null };
  if (/在庫あり|in\s*stock/i.test(text)) return { inStock: true, quantity: null };
  return { inStock: null, quantity: null };
}

function titleMatches(title: string, query: string): boolean {
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const t = norm(title);
  const words = norm(query).split(" ").filter((w) => w.length > 1);
  return words.every((w) => t.includes(w));
}

const ACCESSORY_KEYWORDS = [
  "cable", "adapter", "bracket", "riser", "extension", "connector",
  "fan", "cooler", "thermal", "pad", "holder", "stand", "mount",
  "screw", "washer", "cord", "wire", "power supply", "water block",
  "waterblock", "backplate", "deshroud", "sticker",
];

async function scanYodobashi(
  products: Product[],
  regionCode: string,
): Promise<SourceResult> {
  if (regionCode !== "JP") return { listings: [], errors: [] };
  const region = regionOf(regionCode);
  const listings: PriceListing[] = [];
  const errors: SourceError[] = [];
  const now = new Date().toISOString();

  for (const product of products) {
    const query = queryFor(product, "yodobashi");
    const url = `${SEARCH_URL}?word=${encodeURIComponent(query)}`;
    const res = await fetchText(url);
    if (!res.ok) {
      errors.push(fetchError("yodobashi", regionCode, res));
      continue;
    }
    const $ = cheerio.load(res.body);
    let matched = 0;
    // Yodobashi uses various product card selectors across their templates
    $(
      ".searchResultItem, .pProductBlock, .productItem, div[class*='productList'] > div"
    ).each((_, el) => {
      if (matched >= 8) return;
      const $el = $(el);
      const title =
        $el.find(".pNameBlock, .searchResultName, .product-name, h3, h2").first().text().trim();
      if (!title || !titleMatches(title, query)) return;
      const normTitle = title.toLowerCase();
      if (ACCESSORY_KEYWORDS.some((kw) => normTitle.includes(kw))) return;
      const priceText =
        $el.find(".pPriceBlock, .searchResultPrice, .price, [class*='price']").first().text().trim();
      const price = parsePrice(priceText);
      if (price === null || price <= 0) return;
      const stockText = $el.find(".pAvailability, [class*='availability'], [class*='stock']").first().text().trim();
      const { inStock, quantity } = parseStock(stockText);
      const link = $el.find("a").first().attr("href") ?? url;
      listings.push({
        productId: product.id,
        productName: product.name,
        category: product.category,
        retailer: "yodobashi",
        region,
        condition: "new",
        price,
        currency: region.currency,
        url: link.startsWith("http") ? link : `https://www.yodobashi.com${link}`,
        inStock,
        quantity,
        fetchedAt: now,
      });
      matched++;
    });
    await new Promise((r) => setTimeout(r, 500));
  }

  return { listings, errors };
}

export const yodobashiSource: Source = {
  id: "yodobashi",
  name: "Yodobashi Camera",
  regions: ["JP"],
  categories: ["gpu", "apple", "memory", "amd"],
  scan: (products, ctx) => scanYodobashi(products, ctx.regionCode),
};
