/**
 * Client-safe catalog and formatting helpers — no Node.js imports.
 *
 * Imported by both server and client components. Product metadata is
 * duplicated from the CLI's src/products.ts (the web package can't import
 * the CLI source in a client bundle). The PRODUCT_CATALOG is the source of
 * truth for the web layer; update it when products.ts changes.
 *
 * Hardware images are mapped from the local-ai-web asset library
 * (public/images/hardware/). Products without a dedicated image fall back
 * to a category-colored chip.
 */
import type { PriceListing, ProductPriceSummary } from "../../src/types";

export interface ProductMeta {
  name: string;
  manufacturer: string;
  category: string;
  image?: string;
}

/**
 * Hardware product image paths. Mirrors the mapping in local-ai-web's
 * lib/data/hardware-assets.ts. Products not listed here have no photo
 * and render a colored glyph fallback instead.
 */
const HARDWARE_IMAGES: Record<string, string> = {
  // NVIDIA GPUs — RTX 50 series
  "rtx-5090": "/images/hardware/rtx-5090.png",
  "rtx-5080": "/images/hardware/rtx-5080.png",
  "rtx-5070-ti": "/images/hardware/rtx-5070-ti.png",
  "rtx-5070": "/images/hardware/rtx-5070.png",
  // NVIDIA GPUs — RTX 40 series
  "rtx-4090": "/images/hardware/rtx-4090.png",
  "rtx-4080-super": "/images/hardware/rtx-4080-super.png",
  "rtx-4080": "/images/hardware/rtx-4080.png",
  "rtx-4070-ti-super": "/images/hardware/rtx-4070-ti-super.png",
  "rtx-4070-ti": "/images/hardware/rtx-4070-ti.png",
  "rtx-4070-super": "/images/hardware/rtx-4070-super.png",
  "rtx-4070": "/images/hardware/rtx-4070.png",
  "rtx-4060-ti": "/images/hardware/rtx-4060-ti.png",
  "rtx-4060": "/images/hardware/rtx-4060.png",
  // NVIDIA GPUs — RTX 30 series
  "rtx-3090": "/images/hardware/rtx-3090.png",
  "rtx-3080": "/images/hardware/rtx-3080.png",
  "rtx-3070": "/images/hardware/rtx-3070.png",
  "rtx-3060": "/images/hardware/rtx-3060.png",
  // NVIDIA GPUs — workstation / DGX
  "rtx-pro-6000-blackwell": "/images/hardware/rtx-pro-6000.png",
  "rtx-a6000": "/images/hardware/rtx-a6000.png",
  "dgx-spark": "/images/hardware/dgx-spark-single.png",
  // Apple Silicon — Mac Studio
  "mac-studio-m4-max": "/images/hardware/m3-ultra-mac-studio.png",
  "mac-studio-m3-ultra": "/images/hardware/m3-ultra-mac-studio.png",
  "mac-studio-m1-max": "/images/hardware/mac-studio-m1-max.png",
  "mac-studio-m2-max": "/images/hardware/mac-studio-m2-max.png",
  "mac-studio-m1-ultra": "/images/hardware/mac-studio-m1-ultra.png",
  "mac-studio-m2-ultra": "/images/hardware/mac-studio-m2-ultra.png",
  // Apple Silicon — Mac mini
  "mac-mini-m4": "/images/hardware/m4-pro-mac-mini.png",
  "mac-mini-m4-pro": "/images/hardware/m4-pro-mac-mini.png",
  // Apple Silicon — MacBook Pro
  "macbook-pro-m5": "/images/hardware/m5-pro-macbook-pro.png",
  "macbook-pro-m5-pro": "/images/hardware/m5-pro-macbook-pro.png",
  "macbook-pro-m5-max": "/images/hardware/m5-max-mlx.png",
  "macbook-pro-m4-pro": "/images/hardware/m5-pro-macbook-pro.png",
  "macbook-pro-m4-max": "/images/hardware/m4-max-macbook-pro.png",
  "macbook-pro-m3-max": "/images/hardware/macbook-pro-m3-max.png",
  "macbook-pro-m2-max": "/images/hardware/macbook-pro-m2-max.png",
  "macbook-pro-m1-max": "/images/hardware/macbook-pro-m1-max.png",
};

/** Product metadata keyed by id — mirrors CLI src/products.ts. */
export const PRODUCT_CATALOG: Record<string, ProductMeta> = {
  // ── NVIDIA GPUs — RTX 50 series ──
  "rtx-5090": { name: "RTX 5090", manufacturer: "NVIDIA", category: "gpu", image: HARDWARE_IMAGES["rtx-5090"] },
  "rtx-5080": { name: "RTX 5080", manufacturer: "NVIDIA", category: "gpu", image: HARDWARE_IMAGES["rtx-5080"] },
  "rtx-5070-ti": { name: "RTX 5070 Ti", manufacturer: "NVIDIA", category: "gpu", image: HARDWARE_IMAGES["rtx-5070-ti"] },
  "rtx-5070": { name: "RTX 5070", manufacturer: "NVIDIA", category: "gpu", image: HARDWARE_IMAGES["rtx-5070"] },
  // ── NVIDIA GPUs — RTX 40 series ──
  "rtx-4090": { name: "RTX 4090", manufacturer: "NVIDIA", category: "gpu", image: HARDWARE_IMAGES["rtx-4090"] },
  "rtx-4080-super": { name: "RTX 4080 Super", manufacturer: "NVIDIA", category: "gpu", image: HARDWARE_IMAGES["rtx-4080-super"] },
  "rtx-4080": { name: "RTX 4080", manufacturer: "NVIDIA", category: "gpu", image: HARDWARE_IMAGES["rtx-4080"] },
  "rtx-4070-ti-super": { name: "RTX 4070 Ti Super", manufacturer: "NVIDIA", category: "gpu", image: HARDWARE_IMAGES["rtx-4070-ti-super"] },
  "rtx-4070-ti": { name: "RTX 4070 Ti", manufacturer: "NVIDIA", category: "gpu", image: HARDWARE_IMAGES["rtx-4070-ti"] },
  "rtx-4070-super": { name: "RTX 4070 Super", manufacturer: "NVIDIA", category: "gpu", image: HARDWARE_IMAGES["rtx-4070-super"] },
  "rtx-4070": { name: "RTX 4070", manufacturer: "NVIDIA", category: "gpu", image: HARDWARE_IMAGES["rtx-4070"] },
  "rtx-4060-ti": { name: "RTX 4060 Ti", manufacturer: "NVIDIA", category: "gpu", image: HARDWARE_IMAGES["rtx-4060-ti"] },
  "rtx-4060": { name: "RTX 4060", manufacturer: "NVIDIA", category: "gpu", image: HARDWARE_IMAGES["rtx-4060"] },
  // ── NVIDIA GPUs — RTX 30 series ──
  "rtx-3090": { name: "RTX 3090", manufacturer: "NVIDIA", category: "gpu", image: HARDWARE_IMAGES["rtx-3090"] },
  "rtx-3080": { name: "RTX 3080", manufacturer: "NVIDIA", category: "gpu", image: HARDWARE_IMAGES["rtx-3080"] },
  "rtx-3070": { name: "RTX 3070", manufacturer: "NVIDIA", category: "gpu", image: HARDWARE_IMAGES["rtx-3070"] },
  "rtx-3060": { name: "RTX 3060", manufacturer: "NVIDIA", category: "gpu", image: HARDWARE_IMAGES["rtx-3060"] },
  // ── NVIDIA GPUs — workstation / DGX ──
  "rtx-pro-6000-blackwell": { name: "RTX Pro 6000 Blackwell", manufacturer: "NVIDIA", category: "gpu", image: HARDWARE_IMAGES["rtx-pro-6000-blackwell"] },
  "rtx-a6000": { name: "RTX A6000", manufacturer: "NVIDIA", category: "gpu", image: HARDWARE_IMAGES["rtx-a6000"] },
  "dgx-spark": { name: "NVIDIA DGX Spark", manufacturer: "NVIDIA", category: "gpu", image: HARDWARE_IMAGES["dgx-spark"] },
  // ── Apple Silicon — Mac Studio ──
  "mac-studio-m4-max": { name: "Mac Studio M4 Max", manufacturer: "Apple", category: "apple", image: HARDWARE_IMAGES["mac-studio-m4-max"] },
  "mac-studio-m3-ultra": { name: "Mac Studio M3 Ultra", manufacturer: "Apple", category: "apple", image: HARDWARE_IMAGES["mac-studio-m3-ultra"] },
  "mac-studio-m1-max": { name: "Mac Studio M1 Max", manufacturer: "Apple", category: "apple", image: HARDWARE_IMAGES["mac-studio-m1-max"] },
  "mac-studio-m2-max": { name: "Mac Studio M2 Max", manufacturer: "Apple", category: "apple", image: HARDWARE_IMAGES["mac-studio-m2-max"] },
  "mac-studio-m1-ultra": { name: "Mac Studio M1 Ultra", manufacturer: "Apple", category: "apple", image: HARDWARE_IMAGES["mac-studio-m1-ultra"] },
  "mac-studio-m2-ultra": { name: "Mac Studio M2 Ultra", manufacturer: "Apple", category: "apple", image: HARDWARE_IMAGES["mac-studio-m2-ultra"] },
  // ── Apple Silicon — Mac mini ──
  "mac-mini-m4": { name: "Mac mini M4", manufacturer: "Apple", category: "apple", image: HARDWARE_IMAGES["mac-mini-m4"] },
  "mac-mini-m4-pro": { name: "Mac mini M4 Pro", manufacturer: "Apple", category: "apple", image: HARDWARE_IMAGES["mac-mini-m4-pro"] },
  // ── Apple Silicon — MacBook Pro ──
  "macbook-pro-m5": { name: "MacBook Pro M5", manufacturer: "Apple", category: "apple", image: HARDWARE_IMAGES["macbook-pro-m5"] },
  "macbook-pro-m5-pro": { name: "MacBook Pro M5 Pro", manufacturer: "Apple", category: "apple", image: HARDWARE_IMAGES["macbook-pro-m5-pro"] },
  "macbook-pro-m5-max": { name: "MacBook Pro M5 Max", manufacturer: "Apple", category: "apple", image: HARDWARE_IMAGES["macbook-pro-m5-max"] },
  "macbook-pro-m4-pro": { name: "MacBook Pro M4 Pro", manufacturer: "Apple", category: "apple", image: HARDWARE_IMAGES["macbook-pro-m4-pro"] },
  "macbook-pro-m4-max": { name: "MacBook Pro M4 Max", manufacturer: "Apple", category: "apple", image: HARDWARE_IMAGES["macbook-pro-m4-max"] },
  "macbook-pro-m3-max": { name: "MacBook Pro M3 Max", manufacturer: "Apple", category: "apple", image: HARDWARE_IMAGES["macbook-pro-m3-max"] },
  "macbook-pro-m2-max": { name: "MacBook Pro M2 Max", manufacturer: "Apple", category: "apple", image: HARDWARE_IMAGES["macbook-pro-m2-max"] },
  "macbook-pro-m1-max": { name: "MacBook Pro M1 Max", manufacturer: "Apple", category: "apple", image: HARDWARE_IMAGES["macbook-pro-m1-max"] },
  // ── AMD Strix Halo ──
  "amd-strix-halo-framework-desktop": { name: "Framework Desktop (AMD Ryzen AI Max 395+)", manufacturer: "AMD / Framework", category: "amd", image: "/images/hardware/amd-strix-halo-framework-desktop.png" },
  "amd-strix-halo-mini-pc": { name: "Strix Halo Mini PC (Ryzen AI Max)", manufacturer: "AMD / Minisforum/GMKtec", category: "amd", image: "/images/hardware/amd-strix-halo-mini-pc.png" },
  // ── Memory ──
  "ddr5-32gb-5600": { name: "32GB DDR5-5600 (2×16GB)", manufacturer: "Various", category: "memory", image: "/images/hardware/ddr5-32gb.png" },
  "ddr5-64gb-5600": { name: "64GB DDR5-5600 (2×32GB)", manufacturer: "Various", category: "memory", image: "/images/hardware/ddr5-64gb.png" },
  "ddr4-32gb-3200": { name: "32GB DDR4-3200 (2×16GB)", manufacturer: "Various", category: "memory", image: "/images/hardware/ddr4-32gb.png" },
  "ddr4-ecc-64gb": { name: "64GB DDR4 ECC (Registered)", manufacturer: "Various", category: "memory", image: "/images/hardware/ddr4-ecc-64gb.png" },
  "ddr5-ecc-64gb": { name: "64GB DDR5 ECC (Registered)", manufacturer: "Various", category: "memory", image: "/images/hardware/ddr5-ecc-64gb.png" },
};

/** Full product list for search. */
export const ALL_PRODUCTS = Object.entries(PRODUCT_CATALOG).map(([id, meta]) => ({
  id,
  ...meta,
}));

/** Region definitions (mirrors CLI src/regions.ts). */
export const REGIONS = [
  { code: "ALL", name: "All regions", currency: "" },
  { code: "US", name: "United States", currency: "USD" },
  { code: "DE", name: "Germany", currency: "EUR" },
  { code: "GB", name: "United Kingdom", currency: "GBP" },
  { code: "JP", name: "Japan", currency: "JPY" },
  { code: "PL", name: "Poland", currency: "PLN" },
] as const;

/** Filter listings by region code ("ALL" returns everything). */
export function filterByRegion(listings: PriceListing[], region: string): PriceListing[] {
  if (region === "ALL") return listings;
  return listings.filter((l) => l.region.code === region);
}

/**
 * Compute a per-product summary from a set of listings.
 * When filtering by a single region all listings share one currency, so this
 * is simpler than the CLI's multi-currency summarize().
 */
export function computeSummary(productId: string, listings: PriceListing[]): ProductPriceSummary {
  const newPrices = listings.filter((l) => l.condition === "new").map((l) => l.price);
  const refurbPrices = listings.filter((l) => l.condition === "refurbished").map((l) => l.price);
  const usedPrices = listings.filter((l) => l.condition === "used").map((l) => l.price);

  const retailers = new Set(listings.map((l) => l.retailer));
  const regions = new Set(listings.map((l) => l.region.code));
  const inStock = listings.filter((l) => l.inStock === true).length;
  const currency = listings[0]?.currency ?? "USD";

  const sorted = (arr: number[]) => [...arr].sort((a, b) => a - b);
  const median = (arr: number[]) => {
    if (arr.length === 0) return null;
    const s = sorted(arr);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
  };

  return {
    productId,
    listingCount: listings.length,
    currency,
    lowestNew: newPrices.length ? Math.min(...newPrices) : null,
    highestNew: newPrices.length ? Math.max(...newPrices) : null,
    averageNew: newPrices.length ? newPrices.reduce((s, p) => s + p, 0) / newPrices.length : null,
    medianNew: median(newPrices),
    lowestRefurbished: refurbPrices.length ? Math.min(...refurbPrices) : null,
    lowestUsed: usedPrices.length ? Math.min(...usedPrices) : null,
    retailerCount: retailers.size,
    regionCount: regions.size,
    inStockCount: inStock,
  };
}

/** Format a number as currency. */
export function formatPrice(price: number, currency: string): string {
  const locale: Record<string, string> = {
    USD: "en-US",
    EUR: "de-DE",
    GBP: "en-GB",
    JPY: "ja-JP",
    PLN: "pl-PL",
  };
  try {
    return new Intl.NumberFormat(locale[currency] ?? "en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "JPY" ? 0 : 2,
    }).format(price);
  } catch {
    return `${currency} ${price.toFixed(2)}`;
  }
}

/** Compact price like "$1.2k" for chart axis labels. */
export function formatPriceCompact(price: number, currency: string): string {
  const symbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : currency === "JPY" ? "¥" : currency === "PLN" ? "zł" : "";
  if (price >= 1000) {
    const k = price / 1000;
    return `${symbol}${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}k`;
  }
  return `${symbol}${price.toFixed(0)}`;
}

/** Retailer display names — maps source id to a human-readable label. */
export const RETAILER_NAMES: Record<string, string> = {
  "newegg": "Newegg",
  "amazon": "Amazon",
  "ebay": "eBay",
  "microcenter": "Micro Center",
  "apple-store": "Apple Store",
  "apple-refurbished": "Apple Refurbished",
  "minisforum": "Minisforum",
  "gmktec": "GMKtec",
  "crucial": "Crucial",
  "alternate": "Alternate",
  "allegro": "Allegro",
  "yodobashi": "Yodobashi",
  "dospara": "Dospara",
  "awd-it": "AWD-IT",
  "ceneo": "Ceneo",
};

/** Resolve a retailer id to its display name (falls back to the id). */
export function retailerName(id: string): string {
  return RETAILER_NAMES[id] ?? id;
}

/** Category display labels. */
export const CATEGORY_LABELS: Record<string, string> = {
  gpu: "GPUs",
  apple: "Apple Silicon",
  amd: "AMD Strix Halo",
  memory: "Memory",
};

/** Category accent colors. */
export const CATEGORY_COLORS: Record<string, string> = {
  gpu: "var(--hw-gpu)",
  apple: "var(--hw-apple)",
  amd: "var(--hw-amd)",
  memory: "var(--hw-memory)",
};
