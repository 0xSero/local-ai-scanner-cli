/**
 * Shopify store source — Minisforum + GMKtec expose clean product JSON.
 *
 * Any Shopify store serves `/products.json?limit=250&page=N` with no auth and
 * no anti-bot. Each product has `variants[].{price, available}` and
 * `options[].{name, values}`. For Strix Halo systems the first option is
 * `"CPU"` and lists the exact AMD chip (e.g. "AMD Ryzen™ AI Max+ 395").
 *
 * We filter on the CPU option containing "AI Max" to identify Strix Halo
 * products (vs. Strix Point/Kracken parts like "Ryzen AI 9 HX 370").
 *
 * Stores: store.minisforum.com (no anti-bot), www.gmktec.com (Cloudflare but
 * not challenged). Both are USD/US.
 */
import type { PriceListing, Product, SourceError } from "../types.js";
import type { Source, SourceResult } from "../source.js";
import { fetchText, fetchError } from "../http.js";
import { regionOf } from "../regions.js";

interface ShopifyVariant {
  title: string;
  price: string;
  compare_at_price: string | null;
  sku: string;
  available: boolean;
}

interface ShopifyProduct {
  title: string;
  handle: string;
  vendor: string;
  product_type: string;
  tags: string[];
  options: { name: string; values: string[] }[];
  variants: ShopifyVariant[];
}

interface ShopifyResponse {
  products: ShopifyProduct[];
}

/** Check if a product is a Strix Halo system (CPU option contains "AI Max"). */
function isStrixHalo(product: ShopifyProduct): boolean {
  return product.options.some(
    (opt) => opt.name === "CPU" && opt.values.some((v) => /ai\s*max/i.test(v)),
  );
}

/** Parse Shopify price string ("3639.00") to a number. */
function parsePrice(priceStr: string): number {
  return parseFloat(priceStr);
}

/**
 * Fetch all products from a Shopify store, paginating until empty.
 * Capped at 3 pages to keep the scan bounded.
 */
async function fetchAllProducts(storeUrl: string): Promise<ShopifyProduct[]> {
  const all: ShopifyProduct[] = [];
  for (let page = 1; page <= 3; page++) {
    const url = `${storeUrl}/products.json?limit=250&page=${page}`;
    const res = await fetchText(url);
    if (!res.ok) break;
    try {
      const data = JSON.parse(res.body) as ShopifyResponse;
      if (!data.products || data.products.length === 0) break;
      all.push(...data.products);
    } catch {
      break;
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return all;
}

async function scanShopify(
  storeUrl: string,
  sourceId: string,
  products: Product[],
  regionCode: string,
): Promise<SourceResult> {
  const region = regionOf(regionCode);
  const listings: PriceListing[] = [];
  const errors: SourceError[] = [];
  const now = new Date().toISOString();

  // Only AMD Strix Halo products are relevant for Shopify stores
  const strixProducts = products.filter(
    (p) => p.category === "amd" && p.id.includes("strix-halo"),
  );
  if (strixProducts.length === 0) return { listings, errors };

  const allProducts = await fetchAllProducts(storeUrl);
  if (allProducts.length === 0) {
    errors.push({ retailer: sourceId, region: regionCode, message: "no products returned" });
    return { listings, errors };
  }

  const haloProducts = allProducts.filter(isStrixHalo);
  // Map each Strix Halo product to our catalog. We assign all Shopify Strix
  // Halo products to the "mini-pc" catalog entry since they're all mini PCs
  // built on the same AMD Ryzen AI Max chip. The Framework Desktop entry is
  // handled separately (Framework's store is not Shopify-accessible).
  const miniPcEntry = strixProducts.find((p) => p.id.includes("mini-pc"));

  for (const sp of haloProducts) {
    for (const variant of sp.variants) {
      const price = parsePrice(variant.price);
      if (!price || price <= 0) continue;
      if (miniPcEntry) {
        listings.push({
          productId: miniPcEntry.id,
          productName: sp.title,
          category: miniPcEntry.category,
          retailer: sourceId,
          region,
          condition: "new",
          price,
          currency: region.currency,
          url: `${storeUrl}/products/${sp.handle}`,
          inStock: variant.available,
          quantity: null,
          fetchedAt: now,
        });
      }
    }
  }

  return { listings, errors };
}

export const minisforumSource: Source = {
  id: "minisforum",
  name: "Minisforum Store",
  regions: ["US"],
  categories: ["amd"],
  scan: (products, ctx) =>
    scanShopify("https://store.minisforum.com", "minisforum", products, ctx.regionCode),
};

export const gmktecSource: Source = {
  id: "gmktec",
  name: "GMKtec Store",
  regions: ["US"],
  categories: ["amd"],
  scan: (products, ctx) =>
    scanShopify("https://www.gmktec.com", "gmktec", products, ctx.regionCode),
};
