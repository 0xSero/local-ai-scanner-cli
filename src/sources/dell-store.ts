/**
 * Dell vendor store source — new laptop pricing from the country listing pages.
 *
 * The Dell laptops listing (`https://www.dell.com/{locale}/shop/dell-laptops/
 * scr/laptops`) server-renders each machine as an `<article>` carrying a
 * `data-product-id` and a `data-product-detail` attribute whose (HTML-escaped)
 * JSON holds `dellPrice` (a localized display string), `pdUrl`, and `title`.
 * The store currency is declared once on the page wrapper as
 * `currency="AUD"` — we read it there rather than guessing per country.
 *
 * Only the eight locales that actually server-render prices are registered;
 * the rest return empty/JS-only bodies, time out, or bot-challenge and are
 * deliberately excluded. Catalog machines are matched by their Dell model code
 * (e.g. `da16260`) appearing in a card's `data-product-id`; a machine Dell
 * doesn't sell in a market simply yields no listing there (not an error).
 *
 * Plain HTTP GET, no anti-bot. One fetch per region.
 */
import type { PriceListing, Product, SourceError } from "../types.js";
import type { Source, SourceContext, SourceResult } from "../source.js";
import { fetchText, fetchError } from "../http.js";
import { regionOf } from "../regions.js";

/** Region code → Dell URL locale segment, verified to server-render prices. */
const DELL_LOCALES: Record<string, string> = {
  AU: "en-au",
  NZ: "en-nz",
  SG: "en-sg",
  CA: "en-ca",
  BR: "pt-br",
  DK: "da-dk",
  SE: "sv-se",
  CH: "de-ch",
  IE: "en-ie",
  AT: "de-at",
  BE: "fr-be",
  HK: "en-hk",
  MY: "en-my",
};

/**
 * Catalog product id → Dell model code. The code appears in each card's
 * `data-product-id` (e.g. `xps-da16260-laptop`), so a substring test matches.
 */
const DELL_CODES: Record<string, string> = {
  "dell-xps-16-da16260": "da16260",
  "dell-16-premium-da16250": "da16250",
  "dell-xps-14-da14260": "da14260",
  "dell-xps-13-dx13260": "dx13260",
};

interface DellCard {
  price: number;
  url: string;
}

/**
 * Decode the HTML entities Dell uses inside its data attributes: the named
 * ones plus numeric (`&#233;` / `&#xE9;`) forms that appear in localized slugs.
 * `&amp;` is decoded last so the ampersands it produces aren't re-interpreted.
 */
function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, "&");
}

/**
 * Parse a localized price string ("$3,997.40", "10.599,00 kr", "CHF 799.01")
 * to a number. Keeps only digits and separators, then treats the last of
 * `.`/`,` as the decimal separator (Dell always renders two decimals).
 */
function parsePrice(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.,]/g, "");
  if (!cleaned) return null;
  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");
  let normalized: string;
  if (lastDot >= 0 && lastComma >= 0) {
    const dec = lastDot > lastComma ? "." : ",";
    const thou = dec === "." ? "," : ".";
    normalized = cleaned.split(thou).join("").replace(dec, ".");
  } else if (lastComma >= 0) {
    const oneSep = cleaned.split(",").length === 2;
    normalized = oneSep && cleaned.length - 1 - lastComma === 2 ? cleaned.replace(",", ".") : cleaned.split(",").join("");
  } else if (lastDot >= 0) {
    const oneSep = cleaned.split(".").length === 2;
    normalized = oneSep && cleaned.length - 1 - lastDot === 2 ? cleaned : cleaned.split(".").join("");
  } else {
    normalized = cleaned;
  }
  const n = parseFloat(normalized);
  return n > 0 ? n : null;
}

/** Read the store currency from the page wrapper's `currency="XXX"` attribute. */
function extractCurrency(html: string): string | null {
  const m = html.match(/\bcurrency="([A-Z]{3})"/);
  return m ? m[1] : null;
}

/** Map each product-detail card's model code → its price + product URL. */
function extractCards(html: string): Map<string, DellCard> {
  const out = new Map<string, DellCard>();
  const regex = /data-product-id="([^"]+)"[^>]*data-product-detail='([^']*)'/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(html)) !== null) {
    const id = m[1].toLowerCase();
    let detail: unknown;
    try {
      detail = JSON.parse(decodeEntities(m[2]));
    } catch {
      continue;
    }
    if (!detail || typeof detail !== "object") continue;
    const record = detail as Record<string, { dellPrice?: string; pdUrl?: string }>;
    const first = record[Object.keys(record)[0]];
    if (!first?.dellPrice) continue;
    const price = parsePrice(first.dellPrice);
    if (price === null) continue;
    const url = first.pdUrl ? (first.pdUrl.startsWith("//") ? `https:${first.pdUrl}` : first.pdUrl) : "";
    out.set(id, { price, url });
  }
  return out;
}

async function scanDell(products: Product[], regionCode: string): Promise<SourceResult> {
  const segment = DELL_LOCALES[regionCode];
  const listings: PriceListing[] = [];
  const errors: SourceError[] = [];
  if (!segment) return { listings, errors };
  const region = regionOf(regionCode);
  const now = new Date().toISOString();

  const url = `https://www.dell.com/${segment}/shop/dell-laptops/scr/laptops`;
  const res = await fetchText(url);
  if (!res.ok) {
    errors.push(fetchError("dell-store", regionCode, res));
    return { listings, errors };
  }
  const currency = extractCurrency(res.body) ?? region.currency;
  const cards = extractCards(res.body);

  for (const product of products) {
    const code = DELL_CODES[product.id];
    if (!code) continue;
    let match: DellCard | undefined;
    for (const [id, card] of cards) {
      if (id.includes(code)) {
        match = card;
        break;
      }
    }
    if (!match) continue; // Dell doesn't sell this machine in this market
    listings.push({
      productId: product.id,
      productName: product.name,
      category: product.category,
      retailer: "dell-store",
      region: { ...region, currency },
      condition: "new",
      price: match.price,
      currency,
      url: match.url || url,
      inStock: true,
      quantity: null,
      fetchedAt: now,
    });
  }

  return { listings, errors };
}

export const dellStoreSource: Source = {
  id: "dell-store",
  name: "Dell Store",
  regions: Object.keys(DELL_LOCALES),
  categories: ["laptop"],
  scan: (products: Product[], ctx: SourceContext) => scanDell(products, ctx.regionCode),
};
