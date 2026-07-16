/**
 * Crucial.com source — DDR4/DDR5/ECC memory pricing via JSON-LD.
 *
 * Crucial is an Adobe Experience Manager site with no anti-bot. Product pages
 * (`/memory/{ddr4|ddr5|server}/{PART}`) embed a Schema.org JSON-LD `<script>`
 * with `offers.price`, `priceCurrency`, `availability`, and
 * `additionalProperty[]` (density, module type, technology).
 *
 * Catalog pages (`/catalog/memory/{ddr4|ddr5|server}`) list product-page links
 * but show no prices — we must fetch the catalog to collect part numbers, then
 * fetch individual product pages for pricing. To keep the scan bounded we cap
 * at a handful of representative products per DDR type.
 *
 * Regional mirrors: uk.crucial.com (GBP), eu.crucial.com (EUR) for global.
 */
import type { PriceListing, Product, SourceError } from "../types.js";
import type { Source, SourceResult } from "../source.js";
import { fetchText, fetchError } from "../http.js";
import { regionOf } from "../regions.js";
import { queryFor } from "../products.js";

const REGION_HOST: Record<string, string> = {
  US: "https://www.crucial.com",
  GB: "https://uk.crucial.com",
  DE: "https://eu.crucial.com",
  PL: "https://eu.crucial.com",
  JP: "https://www.crucial.jp",
};

/** Map our memory product ids to Crucial catalog paths and representative parts. */
const PRODUCT_MAP: Record<string, { catalog: string; parts: string[] }> = {
  "ddr5-32gb-5600": {
    catalog: "ddr5",
    parts: ["CT32G48C40U5", "CT32G56C46U5", "CP2K32G56C46U5"],
  },
  "ddr5-64gb-5600": {
    catalog: "ddr5",
    parts: ["CT64G56C46U5", "CP2K32G56C46U5"],
  },
  "ddr4-32gb-3200": {
    catalog: "ddr4",
    parts: ["CT32G4DFD832A", "CT16G4DFD832A"],
  },
  "ddr4-ecc-64gb": {
    catalog: "server",
    parts: ["CT64G4RFS432A", "CT32G4RFD432A"],
  },
  "ddr5-ecc-64gb": {
    catalog: "server",
    parts: ["CT64G56RS432A"],
  },
};

interface CrucialOffer {
  price: string;
  priceCurrency: string;
  availability?: string;
}

interface CrucialProduct {
  "@type": string;
  name: string;
  mpn?: string;
  sku?: string;
  url?: string;
  offers?: CrucialOffer;
  additionalProperty?: { name: string; value: string }[];
}

/** Extract the JSON-LD Product node from a product page. */
function extractProductSchema(html: string): CrucialProduct | null {
  const regex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(html)) !== null) {
    try {
      const obj = JSON.parse(m[1]);
      if (obj["@type"] === "Product") return obj as CrucialProduct;
    } catch {
      // skip
    }
  }
  return null;
}

async function scanCrucial(
  products: Product[],
  regionCode: string,
): Promise<SourceResult> {
  const host = REGION_HOST[regionCode];
  if (!host) return { listings: [], errors: [] };
  const region = regionOf(regionCode);
  const listings: PriceListing[] = [];
  const errors: SourceError[] = [];
  const now = new Date().toISOString();

  // Filter to memory products that have a Crucial mapping
  const memoryProducts = products.filter(
    (p) => p.category === "memory" && PRODUCT_MAP[p.id],
  );

  for (const product of memoryProducts) {
    const { catalog, parts } = PRODUCT_MAP[product.id];
    for (const part of parts) {
      const url = `${host}/memory/${catalog}/${part}`;
      const res = await fetchText(url);
      if (!res.ok) {
        errors.push(fetchError("crucial", regionCode, res));
        continue;
      }
      const schema = extractProductSchema(res.body);
      if (!schema?.offers?.price) {
        errors.push({
          retailer: "crucial",
          region: regionCode,
          message: `no price for ${part}`,
        });
        continue;
      }
      const price = parseFloat(schema.offers.price);
      const currency = schema.offers.priceCurrency || region.currency;
      const inStock = schema.offers.availability?.includes("InStock") ?? null;
      listings.push({
        productId: product.id,
        productName: schema.name || product.name,
        category: product.category,
        retailer: "crucial",
        region: { ...region, currency },
        condition: "new",
        price,
        currency,
        url,
        inStock,
        quantity: null,
        fetchedAt: now,
      });
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  return { listings, errors };
}

export const crucialSource: Source = {
  id: "crucial",
  name: "Crucial.com",
  regions: ["US", "GB", "DE", "PL", "JP"],
  categories: ["memory"],
  scan: (products, ctx) => scanCrucial(products, ctx.regionCode),
};
