/**
 * Lenovo vendor store source — new laptop pricing across country storefronts.
 *
 * Lenovo product pages (`https://www.lenovo.com/{cc}/{lang}/p/{code}`) are
 * server-rendered: the short product code (e.g. `len101t0159`) 200-redirects to
 * the full slug, and the served HTML embeds the selling price as a JSON
 * `"price":<number>` field. The currency is declared in the page head as
 * `<meta name="currencycode" content="EUR">` — we read it from there rather
 * than guessing a country→currency mapping.
 *
 * `len101t0159` is the ThinkPad X1 Carbon (the current Aura Edition generation
 * Lenovo sells worldwide); it is the stable cross-locale key for our catalog
 * ThinkPad X1 Carbon entry. Only locales that actually render a price in the
 * served HTML are registered — PL/AE/ZA return 200 with a JS-only body (no SSR
 * price) and are deliberately excluded.
 *
 * Plain HTTP GET, no anti-bot. One fetch per region.
 */
import type { PriceListing, Product, SourceError } from "../types.js";
import type { Source, SourceContext, SourceResult } from "../source.js";
import { fetchText, fetchError } from "../http.js";
import { regionOf } from "../regions.js";

/**
 * Region code → { cc, lang } path segments for the Lenovo storefront URL.
 * Only locales verified to render a server-side price are listed; the source's
 * `regions` array is derived from these keys.
 */
const LENOVO_LOCALES: Record<string, { cc: string; lang: string }> = {
  GB: { cc: "gb", lang: "en" },
  FR: { cc: "fr", lang: "fr" },
  IT: { cc: "it", lang: "it" },
  ES: { cc: "es", lang: "es" },
  NL: { cc: "nl", lang: "nl" },
  DE: { cc: "de", lang: "de" },
  AT: { cc: "at", lang: "de" },
  BE: { cc: "be", lang: "nl" },
  CH: { cc: "ch", lang: "de" },
  DK: { cc: "dk", lang: "da" },
  FI: { cc: "fi", lang: "fi" },
  NO: { cc: "no", lang: "no" },
  SE: { cc: "se", lang: "sv" },
  PT: { cc: "pt", lang: "pt" },
  IE: { cc: "ie", lang: "en" },
  JP: { cc: "jp", lang: "ja" },
  CA: { cc: "ca", lang: "en" },
  IN: { cc: "in", lang: "en" },
  SG: { cc: "sg", lang: "en" },
  KR: { cc: "kr", lang: "ko" },
  TW: { cc: "tw", lang: "zh" },
  BR: { cc: "br", lang: "pt" },
  MX: { cc: "mx", lang: "es" },
  AU: { cc: "au", lang: "en" },
  NZ: { cc: "nz", lang: "en" },
};

/**
 * Catalog product id → Lenovo short product code. Kept here (not in the
 * catalog) so the product model stays vendor-agnostic; add a row when a new
 * Lenovo machine enters the catalog.
 */
const LENOVO_CODES: Record<string, string> = {
  "lenovo-thinkpad-x1-carbon-g12": "len101t0159",
};

/** Read the store currency from the page's `<meta name="currencycode">` tag. */
function extractCurrency(html: string): string | null {
  const m = html.match(/<meta\s+name=['"]currencycode['"]\s+content=['"]([A-Z]{3})['"]/i);
  return m ? m[1] : null;
}

/** Read the first embedded `"price":<number>` — the selling price Lenovo SSRs. */
function extractPrice(html: string): number | null {
  const m = html.match(/"price"\s*:\s*([0-9]+(?:\.[0-9]+)?)/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return n > 0 ? n : null;
}

async function scanLenovo(products: Product[], regionCode: string): Promise<SourceResult> {
  const locale = LENOVO_LOCALES[regionCode];
  const listings: PriceListing[] = [];
  const errors: SourceError[] = [];
  if (!locale) return { listings, errors };
  const region = regionOf(regionCode);
  const now = new Date().toISOString();

  for (const product of products) {
    const code = LENOVO_CODES[product.id];
    if (!code) continue;
    const url = `https://www.lenovo.com/${locale.cc}/${locale.lang}/p/${code}`;
    const res = await fetchText(url);
    if (!res.ok) {
      errors.push(fetchError("lenovo", regionCode, res));
      continue;
    }
    const price = extractPrice(res.body);
    if (price === null) {
      errors.push({ retailer: "lenovo", region: regionCode, message: "no server-rendered price" });
      continue;
    }
    const currency = extractCurrency(res.body) ?? region.currency;
    listings.push({
      productId: product.id,
      productName: product.name,
      category: product.category,
      retailer: "lenovo",
      region: { ...region, currency },
      condition: "new",
      price,
      currency,
      url: res.finalUrl || url,
      inStock: true,
      quantity: null,
      fetchedAt: now,
    });
    await sleep(400);
  }

  return { listings, errors };
}

/** Politeness delay between fetches. */
function sleep(ms: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
}

export const lenovoSource: Source = {
  id: "lenovo",
  name: "Lenovo Store",
  regions: Object.keys(LENOVO_LOCALES),
  categories: ["laptop"],
  scan: (products: Product[], ctx: SourceContext) => scanLenovo(products, ctx.regionCode),
};
