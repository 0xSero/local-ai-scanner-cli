/**
 * Microcenter source — US electronics retailer (USD), HTML scraping.
 *
 * Micro Center's search page (`/search/search_results.aspx?Ntt=QUERY`) is
 * server-rendered ASP.NET with `.pDescription` product blocks. Each block has:
 *   `.pName` → product title (anchor link to /product/PROD_ID/...)
 *   `.pPrice` → price ("$1,599.99")
 *   `.inventory` → "In Stock: X" at a specific store (best-effort)
 *
 * Micro Center historically returned 403 to non-browser UAs but now serves
 * content with a desktop Chrome UA. Stock is per-store; we treat any
 * in-stock indication as inStock=true. Micro Center does not show quantity
 * counts in search results — those are on product detail pages only.
 */
import * as cheerio from "cheerio";
import type { PriceListing, Product, SourceError } from "../types.js";
import type { Source, SourceResult } from "../source.js";
import { fetchText, fetchError } from "../http.js";
import { regionOf } from "../regions.js";
import { queryFor } from "../products.js";

const SEARCH_URL = "https://www.microcenter.com/search/search_results.aspx?Ntt=";

/** Parse a US-format price like "$1,599.99" → 1599.99 */
function parsePrice(text: string): number | null {
  const cleaned = text.replace(/[^0-9.]/g, "").trim();
  if (!cleaned) return null;
  return parseFloat(cleaned);
}

/** Parse "In Stock: 5" → 5, or "Out of Stock" → null. */
function parseQuantity(text: string): { inStock: boolean; quantity: number | null } {
  const stockMatch = text.match(/in\s*stock/i);
  const qtyMatch = text.match(/(\d+)\s*(?:available|in stock|left)/i);
  if (/out\s*of\s*stock/i.test(text)) return { inStock: false, quantity: 0 };
  return {
    inStock: !!stockMatch,
    quantity: qtyMatch ? parseInt(qtyMatch[1], 10) : null,
  };
}

function isCaptcha(html: string): boolean {
  return /captcha|access denied|blocked|robot/i.test(html);
}

function titleMatches(title: string, query: string): boolean {
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const t = norm(title);
  const words = norm(query).split(" ").filter((w) => w.length > 1);
  return words.every((w) => t.includes(w));
}

const SYSTEM_KEYWORDS = [
  "desktop", "laptop", "workstation", "server", "prebuilt", "pre-built",
  "tower", "barebone", "gaming pc", "pc build", "system",
];

const ACCESSORY_KEYWORDS = [
  "cable", "adapter", "bracket", "riser", "extension", "connector",
  "fan", "cooler", "thermal", "pad", "holder", "stand", "mount",
  "screw", "washer", "cord", "wire", "power supply", "water block",
  "waterblock", "backplate", "deshroud", "sticker",
];

async function scanMicrocenter(
  products: Product[],
  regionCode: string,
): Promise<SourceResult> {
  if (regionCode !== "US") return { listings: [], errors: [] };
  const region = regionOf(regionCode);
  const listings: PriceListing[] = [];
  const errors: SourceError[] = [];
  const now = new Date().toISOString();

  for (const product of products) {
    const query = queryFor(product, "microcenter");
    const url = `${SEARCH_URL}${encodeURIComponent(query)}`;
    const res = await fetchText(url);
    if (!res.ok) {
      errors.push(fetchError("microcenter", regionCode, res));
      continue;
    }
    if (isCaptcha(res.body)) {
      errors.push({ retailer: "microcenter", region: regionCode, message: "captcha/blocked page returned" });
      continue;
    }
    const $ = cheerio.load(res.body);
    let matched = 0;
    // Micro Center uses .pDescription (or .productdetail) blocks
    $("article.pDescription, li.pDescription, div.pDescription, div.productdetail").each((_, el) => {
      if (matched >= 8) return;
      const $el = $(el);
      const title = $el.find(".pName, h2, h3").first().text().trim();
      if (!title || !titleMatches(title, query)) return;
      const normTitle = title.toLowerCase();
      if (ACCESSORY_KEYWORDS.some((kw) => normTitle.includes(kw))) return;
      if (product.category === "gpu" && SYSTEM_KEYWORDS.some((kw) => normTitle.includes(kw))) return;
      const priceText = $el.find(".pPrice, .price").first().text().trim();
      const price = parsePrice(priceText);
      if (price === null || price <= 0) return;
      const inventoryText = $el.find(".inventory, .stock").first().text().trim();
      const { inStock, quantity } = inventoryText ? parseQuantity(inventoryText) : { inStock: null, quantity: null };
      const link = $el.find("a").first().attr("href") ?? url;
      listings.push({
        productId: product.id,
        productName: product.name,
        category: product.category,
        retailer: "microcenter",
        region,
        condition: "new",
        price,
        currency: region.currency,
        url: link.startsWith("http") ? link : `https://www.microcenter.com${link}`,
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

export const microcenterSource: Source = {
  id: "microcenter",
  name: "Micro Center",
  regions: ["US"],
  categories: ["gpu", "apple", "memory", "amd"],
  scan: (products, ctx) => scanMicrocenter(products, ctx.regionCode),
};
