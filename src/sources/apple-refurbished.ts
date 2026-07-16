/**
 * Apple Certified Refurbished source — refurbished pricing across country stores.
 *
 * The refurb page (`/{cc}/shop/refurbished/mac`) embeds each product as a
 * Schema.org JSON-LD `<script type="application/ld+json">` block with a
 * `Product` node. Each has `name`, `url`, and `offers[0]` with `price`
 * (number), `priceCurrency`, and `itemCondition`. ~180–260 products per page,
 * all on a single page (no pagination).
 *
 * We match refurb items to our catalog by normalizing the product type
 * ("Mac Studio", "MacBook Pro") and chip family ("M3 Ultra", "M2 Max") from
 * the `appleChip` field. Apple uses the non-ASCII hyphen U+2011 in names; we
 * normalize it. Refurb is best-effort/in-stock-only — discontinued chips may
 * simply not be available.
 */
import type { PriceListing, SourceError } from "../types.js";
import type { Source, SourceResult } from "../source.js";
import { fetchText, fetchError } from "../http.js";
import { regionOf } from "../regions.js";
import { appleProducts } from "../products.js";

const COUNTRY_PREFIX: Record<string, string> = {
  US: "",
  DE: "/de",
  GB: "/uk",
  JP: "/jp",
  PL: "/pl",
};

interface RefurbOffer {
  price: number;
  priceCurrency: string;
  itemCondition?: string;
  sku?: string;
}

interface RefurbProduct {
  "@type": string;
  name: string;
  url: string;
  offers?: RefurbOffer | RefurbOffer[];
}

/** Normalize text for loose matching: lowercase, ASCII hyphens, collapse spaces. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/\u2011/g, "-") // non-ASCII hyphen → ASCII
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Convert an appleChip id like "m3ultra" to a searchable label "m3 ultra".
 *  Handles: m4 → "m4", m4pro → "m4 pro", m5max → "m5 max", m3ultra → "m3 ultra". */
function chipSearchTerm(chip: string): string {
  return chip
    .replace(/pro/, " pro")
    .replace(/max/, " max")
    .replace(/ultra/, " ultra")
    .replace(/\s+/g, " ")
    .trim();
}

/** Convert an applePage like "mac-studio" to a searchable label "mac studio". */
function pageSearchTerm(page: string): string {
  return page.replace(/-/g, " ").trim();
}

/** Extract all JSON-LD Product nodes from the page. */
function extractRefurbProducts(html: string): RefurbProduct[] {
  const out: RefurbProduct[] = [];
  const regex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(html)) !== null) {
    try {
      const obj = JSON.parse(m[1]);
      // Could be a single object, an array, or have @graph
      const candidates: unknown[] = Array.isArray(obj) ? obj : [obj];
      for (const c of candidates) {
        const node = c as Record<string, unknown>;
        if (node["@type"] === "Product") {
          out.push(node as unknown as RefurbProduct);
        }
        // Check @graph arrays
        if (Array.isArray(node["@graph"])) {
          for (const g of node["@graph"]) {
            if ((g as Record<string, unknown>)["@type"] === "Product") {
              out.push(g as unknown as RefurbProduct);
            }
          }
        }
      }
    } catch {
      // skip unparseable blocks
    }
  }
  return out;
}

async function scanAppleRefurb(regionCode: string): Promise<SourceResult> {
  const prefix = COUNTRY_PREFIX[regionCode];
  if (prefix === undefined) return { listings: [], errors: [] };
  const region = regionOf(regionCode);
  const listings: PriceListing[] = [];
  const errors: SourceError[] = [];
  const now = new Date().toISOString();

  const url = `https://www.apple.com${prefix}/shop/refurbished/mac`;
  const res = await fetchText(url);
  if (!res.ok) {
    errors.push(fetchError("apple-refurbished", regionCode, res));
    return { listings, errors };
  }

  const refurbProducts = extractRefurbProducts(res.body);
  const appleProds = appleProducts();

  for (const rp of refurbProducts) {
    const name = norm(rp.name);
    const offerList: RefurbOffer[] = Array.isArray(rp.offers) ? rp.offers : rp.offers ? [rp.offers] : [];
    if (offerList.length === 0) continue;
    const offer = offerList[0];
    if (!offer.price || offer.price <= 0) continue;

    const currency = offer.priceCurrency || region.currency;

    // Match against our catalog: check product type + chip family.
    // For base chips (no suffix), require an exact "M{n} " boundary so
    // "m5" doesn't match "m5 max" or "m5 pro". For suffixed chips like
    // "m5 max", a plain includes() is fine since the suffix disambiguates.
    for (const product of appleProds) {
      const pageTerm = pageSearchTerm(product.applePage!);
      const chipTerm = chipSearchTerm(product.appleChip!);
      if (!name.includes(pageTerm)) continue;
      const isBaseChip = !/pro|max|ultra/.test(product.appleChip!);
      const chipMatches = isBaseChip
        ? new RegExp(`\\b${chipTerm.replace(/\s+/g, "\\s+")}\\b`, "i").test(name)
        : name.includes(chipTerm);
      if (!chipMatches) continue;
      listings.push({
        productId: product.id,
        productName: rp.name,
        category: product.category,
        retailer: "apple-refurbished",
        region: { ...region, currency },
        condition: "refurbished",
        price: offer.price,
        currency,
        url: rp.url || url,
        inStock: true,
        quantity: null,
        fetchedAt: now,
      });
      break; // one listing per catalog product per refurb item
    }
  }

  return { listings, errors };
}

export const appleRefurbishedSource: Source = {
  id: "apple-refurbished",
  name: "Apple Certified Refurbished",
  regions: ["US", "DE", "GB", "JP", "PL"],
  categories: ["apple"],
  scan: (_products, ctx) => scanAppleRefurb(ctx.regionCode),
};
