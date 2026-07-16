/**
 * Dospara source — Japanese PC parts retailer (JPY), Salesforce Commerce Cloud.
 *
 * Search URL: `/products/all-item?q=QUERY` (returns 200, server-rendered).
 *
 * Each product card is a `.p-products-all-item-product` div containing:
 *   `.p-products-all-item-product__name__text` — product title (inside an <a>)
 *   `.p-products-all-item-product__number`     — price digits ("199,980")
 *   `.p-products-all-item-product__price`      — price block (includes "円")
 *   `.p-products-all-item-product__shipment`   — stock/availability text
 *   `a[href]`                                  — product detail URL
 *
 * Dospara specializes in PC components and custom-built systems. Many search
 * results for GPU names are pre-built PCs — we filter those with SYSTEM_KEYWORDS.
 * No anti-bot; plain HTTP GET with a desktop UA works. Prices in JPY (comma
 * thousands, no decimal, "円" suffix).
 */
import * as cheerio from "cheerio";
import type { PriceListing, Product, SourceError } from "../types.js";
import type { Source, SourceResult } from "../source.js";
import { fetchText, fetchError } from "../http.js";
import { regionOf } from "../regions.js";
import { queryFor } from "../products.js";

const SEARCH_URL = "https://www.dospara.co.jp/products/all-item";

/** Parse a Japanese-format price like "199,980" → 199980 */
function parsePrice(text: string): number | null {
  const cleaned = text.replace(/[^0-9,]/g, "").trim();
  if (!cleaned) return null;
  return parseFloat(cleaned.replace(/,/g, ""));
}

/** Parse stock from shipment/availability text. Dospara shows "在庫" (stock). */
function parseStock(text: string): { inStock: boolean | null; quantity: number | null } {
  if (/在庫切れ|out\s*of\s*stock|売り切れ|なし/i.test(text)) return { inStock: false, quantity: 0 };
  if (/在庫あり|in\s*stock|◎|○/i.test(text)) return { inStock: true, quantity: null };
  if (/在庫僅少|△/i.test(text)) return { inStock: true, quantity: null };
  return { inStock: null, quantity: null };
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
  "搭載", "ノートパソコン", "デスクトップ", "ミニPC", "BTO",
  "ryzen5", "ryzen7", "core i", "intel core",
];

const ACCESSORY_KEYWORDS = [
  "cable", "adapter", "bracket", "riser", "extension", "connector",
  "fan", "cooler", "thermal", "pad", "holder", "stand", "mount",
  "screw", "washer", "cord", "wire", "power supply", "water block",
  "waterblock", "backplate", "deshroud", "sticker",
];

async function scanDospara(
  products: Product[],
  regionCode: string,
): Promise<SourceResult> {
  if (regionCode !== "JP") return { listings: [], errors: [] };
  const region = regionOf(regionCode);
  const listings: PriceListing[] = [];
  const errors: SourceError[] = [];
  const now = new Date().toISOString();

  for (const product of products) {
    const query = queryFor(product, "dospara");
    const url = `${SEARCH_URL}?q=${encodeURIComponent(query)}`;
    const res = await fetchText(url);
    if (!res.ok) {
      errors.push(fetchError("dospara", regionCode, res));
      continue;
    }
    const $ = cheerio.load(res.body);
    let matched = 0;
    $(".p-products-all-item-product").each((_, el) => {
      if (matched >= 8) return;
      const $el = $(el);
      const title = $el.find(".p-products-all-item-product__name__text").text().trim();
      if (!title || !titleMatches(title, query)) return;
      const normTitle = title.toLowerCase();
      if (ACCESSORY_KEYWORDS.some((kw) => normTitle.includes(kw))) return;
      if (product.category === "gpu" && SYSTEM_KEYWORDS.some((kw) => normTitle.includes(kw))) return;
      const priceText = $el.find(".p-products-all-item-product__number").first().text().trim();
      const price = parsePrice(priceText);
      if (price === null || price <= 0) return;
      const stockText = $el.find(".p-products-all-item-product__shipment, [class*='shipment']").first().text().trim();
      const { inStock, quantity } = parseStock(stockText);
      const link = $el.find("a").first().attr("href") ?? url;
      listings.push({
        productId: product.id,
        productName: product.name,
        category: product.category,
        retailer: "dospara",
        region,
        condition: "new",
        price,
        currency: region.currency,
        url: link.startsWith("http") ? link : `https://www.dospara.co.jp${link}`,
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

export const dosparaSource: Source = {
  id: "dospara",
  name: "Dospara",
  regions: ["JP"],
  categories: ["gpu", "memory", "amd"],
  scan: (products, ctx) => scanDospara(products, ctx.regionCode),
};
