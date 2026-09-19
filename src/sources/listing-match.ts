/**
 * Shared listing matchers for retailer search results.
 *
 * A search page returns loosely related text: a query for "RTX 6000 Ada" returns
 * the card's water block, its power cable and whole machines that contain it.
 * Three sources (alternate, ceneo, awd-it) need the same rules, so they live here
 * rather than being copied per source.
 */

/**
 * Keywords that mark a listing as an accessory rather than the product itself.
 * A card's name appears in the title of its water block, its cable and its
 * anti-sag bracket, and those are priced an order of magnitude below the card:
 * a query for "RTX 6000 Ada" returns an Alphacool water block at 169.90 EUR.
 */
export const ACCESSORY_KEYWORDS = [
  "cable", "adapter", "bracket", "riser", "extension", "connector",
  "fan", "cooler", "thermal", "pad", "holder", "stand", "mount",
  "screw", "washer", "cord", "wire", "case fan", "power supply",
  "bracket kit", "support", "anti-sag", "water block", "waterblock",
  "backplate", "deshroud", "replacement", "repair", "decals", "sticker",
  "keycap", "mousepad", "poster", "shirt", "mug", "monitor", "case",
  "mid tower", "atx case", "alphacool", "phanteks", "barrow", "bykski",
  "dock", "hub",
];

/**
 * Keywords that mark a listing as a complete system (laptop, pre-built PC)
 * rather than a standalone component. Search engines and retailers index whole
 * machines under the name of the card they contain, and a machine's price is not
 * the card's price.
 *
 * Deliberately absent: "workstation" and "server". NVIDIA names real cards
 * "RTX PRO 6000 Blackwell Workstation Edition" and "... Server Edition", so
 * those words identify a card as often as a machine.
 */
export const SYSTEM_KEYWORDS = [
  "laptop", "desktop", "prebuilt", "pre-built", "prebuilt gaming pc",
  "tower", "barebone", "gaming pc", "pc build", "system", "notebook",
  "configured", "bundle", "ryzen", "intel core", "ddr5 ram", "ssd",
  "windows 11",
];

/** Normalise text for matching: lowercase, punctuation to spaces, collapse. */
export function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Tokens that name a higher variant of the same product line. A query is a
 * prefix of a longer product's name — "RTX 5060" starts "RTX 5060 Ti",
 * "RTX 4080" starts "RTX 4080 Super", "MacBook Pro M2" starts "MacBook Pro
 * M2 Pro" — and the longer variant costs more, so the shorter product must not
 * claim its listings.
 */
const VARIANT_SUFFIXES = new Set([
  "ti", "super", "ada", "laptop", "mobile", "pro", "max", "ultra", "xtx",
]);

/**
 * True when every word of the query (longer than one character) appears in the
 * text and the text does not name a higher variant of the product.
 *
 * Search pages carry the product name in the card text and the URL slug. Two
 * traps make a plain word-presence test too weak:
 *
 * - A base product matches every longer variant. The same Amazon ASIN is the
 *   lowest-priced "RTX 3060" and "RTX 3060 Ti" listing, and a query for
 *   "MacBook Pro M2" matches a refurbished "MacBook Pro M2 Pro".
 * - A query that ends in a variant word is satisfied by the model name. The
 *   query "MacBook Pro M1 Pro" matched a base "MacBook Pro ... M1 chip"
 *   listing, whose "MacBook Pro" supplied the second "pro".
 *
 * So a query ending in a variant word must name the model and the variant
 * together, and the word the last query word sits in must not extend it into a
 * variant ("xtx" extends "xt", "5090ti" extends "5090"), nor may a variant
 * word follow it ("RTX 5060 Ti", "MacBook Pro M2 Pro").
 */
export function titleMatches(text: string, query: string): boolean {
  const haystack = normalizeText(text);
  const words = normalizeText(query).split(" ").filter((word) => word.length > 1);
  if (!words.every((word) => haystack.includes(word))) return false;

  const lastWord = words[words.length - 1];
  if (words.length >= 2 && VARIANT_SUFFIXES.has(lastWord)) {
    return haystack.includes(`${words[words.length - 2]} ${lastWord}`);
  }

  const at = haystack.lastIndexOf(lastWord);
  const wordStart = haystack.lastIndexOf(" ", at) + 1;
  const wordEnd = haystack.indexOf(" ", at);
  const word = haystack.slice(wordStart, wordEnd === -1 ? undefined : wordEnd);
  // "xtx" extends "xt" and "m5max" extends "m5", but "2x16gb" merely
  // contains "16gb" — the extension has to be a variant marker itself.
  if (word !== lastWord && VARIANT_SUFFIXES.has(word)) return false;
  if (word.startsWith(lastWord) && VARIANT_SUFFIXES.has(word.slice(lastWord.length))) return false;

  const next = haystack.slice(at + lastWord.length).trim().split(" ")[0];
  return next === undefined || !VARIANT_SUFFIXES.has(next);
}

/** True when the listing title names an accessory rather than the product. */
export function isAccessoryListing(title: string): boolean {
  const normalized = title.toLowerCase();
  return ACCESSORY_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

/**
 * True when the listing title names a complete system. Only meaningful for
 * component searches: a laptop or pre-built carries a GPU's name in its title,
 * but its price is the whole machine's.
 */
export function isSystemListing(title: string, category: string): boolean {
  if (category !== "gpu") return false;
  const normalized = title.toLowerCase();
  return SYSTEM_KEYWORDS.some((keyword) => normalized.includes(keyword));
}
