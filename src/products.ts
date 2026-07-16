/**
 * The product catalog — everything the scanner knows how to price.
 *
 * Each product carries per-source search queries because retailers index
 * products inconsistently. The default query falls back to the product name.
 *
 * `queries` keys map to source ids in sources/. A missing key means "use the
 * product name as the search query for that source."
 *
 * For Apple products, the `appleChip` field helps the Apple Store source match
 * embedded chip-keyed prices (e.g. "m3ultra-28-60"). Discontinued chips (M1/M2
 * Max, M1/M2 Ultra) won't appear on the new store — they're refurb-only.
 */
import type { Product } from "./types.js";

export interface AppleProduct extends Product {
  /** Chip family for Apple Store matching, e.g. "m3ultra", "m4max". */
  appleChip?: string;
  /** Which Apple buy page this product lives on. */
  applePage?: "mac-studio" | "macbook-pro" | "mac-mini";
}

export const PRODUCTS: AppleProduct[] = [
  // ── NVIDIA GPUs — RTX 50 series ────────────────────────────────────────
  {
    id: "rtx-5090",
    name: "RTX 5090",
    category: "gpu",
    manufacturer: "NVIDIA",
    queries: { newegg: "RTX 5090", amazon: "RTX 5090", alternate: "RTX 5090" },
    minPriceUsd: 1500,
  },
  {
    id: "rtx-5080",
    name: "RTX 5080",
    category: "gpu",
    manufacturer: "NVIDIA",
    queries: { newegg: "RTX 5080", amazon: "RTX 5080", alternate: "RTX 5080" },
    minPriceUsd: 900,
  },
  {
    id: "rtx-5070-ti",
    name: "RTX 5070 Ti",
    category: "gpu",
    manufacturer: "NVIDIA",
    queries: { newegg: "RTX 5070 Ti", amazon: "RTX 5070 Ti", alternate: "RTX 5070 Ti" },
    minPriceUsd: 600,
  },
  {
    id: "rtx-5070",
    name: "RTX 5070",
    category: "gpu",
    manufacturer: "NVIDIA",
    queries: { newegg: "RTX 5070", amazon: "RTX 5070", alternate: "RTX 5070" },
    minPriceUsd: 500,
  },

  // ── NVIDIA GPUs — RTX 40 series ────────────────────────────────────────
  {
    id: "rtx-4090",
    name: "RTX 4090",
    category: "gpu",
    manufacturer: "NVIDIA",
    queries: { newegg: "RTX 4090", amazon: "RTX 4090", alternate: "RTX 4090" },
    minPriceUsd: 1200,
  },
  {
    id: "rtx-4080-super",
    name: "RTX 4080 Super",
    category: "gpu",
    manufacturer: "NVIDIA",
    queries: { newegg: "RTX 4080 Super", amazon: "RTX 4080 Super", alternate: "RTX 4080 Super" },
    minPriceUsd: 800,
  },
  {
    id: "rtx-4080",
    name: "RTX 4080",
    category: "gpu",
    manufacturer: "NVIDIA",
    queries: { newegg: "RTX 4080", amazon: "RTX 4080", alternate: "RTX 4080" },
    minPriceUsd: 800,
  },
  {
    id: "rtx-4070-ti-super",
    name: "RTX 4070 Ti Super",
    category: "gpu",
    manufacturer: "NVIDIA",
    queries: { newegg: "RTX 4070 Ti Super", amazon: "RTX 4070 Ti Super", alternate: "RTX 4070 Ti Super" },
    minPriceUsd: 700,
  },
  {
    id: "rtx-4070-ti",
    name: "RTX 4070 Ti",
    category: "gpu",
    manufacturer: "NVIDIA",
    queries: { newegg: "RTX 4070 Ti", amazon: "RTX 4070 Ti", alternate: "RTX 4070 Ti" },
    minPriceUsd: 600,
  },
  {
    id: "rtx-4070-super",
    name: "RTX 4070 Super",
    category: "gpu",
    manufacturer: "NVIDIA",
    queries: { newegg: "RTX 4070 Super", amazon: "RTX 4070 Super", alternate: "RTX 4070 Super" },
    minPriceUsd: 500,
  },
  {
    id: "rtx-4070",
    name: "RTX 4070",
    category: "gpu",
    manufacturer: "NVIDIA",
    queries: { newegg: "RTX 4070", amazon: "RTX 4070", alternate: "RTX 4070" },
    minPriceUsd: 450,
  },
  {
    id: "rtx-4060-ti",
    name: "RTX 4060 Ti",
    category: "gpu",
    manufacturer: "NVIDIA",
    queries: { newegg: "RTX 4060 Ti", amazon: "RTX 4060 Ti", alternate: "RTX 4060 Ti" },
    minPriceUsd: 300,
  },
  {
    id: "rtx-4060",
    name: "RTX 4060",
    category: "gpu",
    manufacturer: "NVIDIA",
    queries: { newegg: "RTX 4060", amazon: "RTX 4060", alternate: "RTX 4060" },
    minPriceUsd: 250,
  },

  // ── NVIDIA GPUs — RTX 30 series ────────────────────────────────────────
  {
    id: "rtx-3090",
    name: "RTX 3090",
    category: "gpu",
    manufacturer: "NVIDIA",
    queries: { newegg: "RTX 3090", amazon: "RTX 3090", alternate: "RTX 3090" },
    minPriceUsd: 600,
  },
  {
    id: "rtx-3080",
    name: "RTX 3080",
    category: "gpu",
    manufacturer: "NVIDIA",
    queries: { newegg: "RTX 3080", amazon: "RTX 3080", alternate: "RTX 3080" },
    minPriceUsd: 400,
  },
  {
    id: "rtx-3070",
    name: "RTX 3070",
    category: "gpu",
    manufacturer: "NVIDIA",
    queries: { newegg: "RTX 3070", amazon: "RTX 3070", alternate: "RTX 3070" },
    minPriceUsd: 300,
  },
  {
    id: "rtx-3060",
    name: "RTX 3060",
    category: "gpu",
    manufacturer: "NVIDIA",
    queries: { newegg: "RTX 3060", amazon: "RTX 3060", alternate: "RTX 3060" },
    minPriceUsd: 200,
  },

  // ── NVIDIA GPUs — workstation / DGX ────────────────────────────────────
  {
    id: "rtx-pro-6000-blackwell",
    name: "RTX Pro 6000 Blackwell",
    category: "gpu",
    manufacturer: "NVIDIA",
    queries: { newegg: "RTX Pro 6000 Blackwell", amazon: "RTX Pro 6000 Blackwell" },
    minPriceUsd: 4000,
  },
  {
    id: "rtx-a6000",
    name: "RTX A6000",
    category: "gpu",
    manufacturer: "NVIDIA",
    queries: { newegg: "RTX A6000", amazon: "RTX A6000", alternate: "RTX A6000" },
    minPriceUsd: 3000,
  },
  {
    id: "dgx-spark",
    name: "NVIDIA DGX Spark",
    category: "gpu",
    manufacturer: "NVIDIA",
    queries: { newegg: "DGX Spark", amazon: "NVIDIA DGX Spark" },
    minPriceUsd: 3000,
  },

  // ── Apple Silicon — Mac Studio ─────────────────────────────────────────
  // Current-gen (new store): M4 Max, M3 Ultra
  // Legacy (refurb/Amazon only): M1/M2 Max, M1/M2 Ultra
  {
    id: "mac-studio-m4-max",
    name: "Mac Studio M4 Max",
    category: "apple",
    manufacturer: "Apple",
    appleChip: "m4max",
    applePage: "mac-studio",
    queries: { amazon: "Mac Studio M4 Max" },
  },
  {
    id: "mac-studio-m3-ultra",
    name: "Mac Studio M3 Ultra",
    category: "apple",
    manufacturer: "Apple",
    appleChip: "m3ultra",
    applePage: "mac-studio",
    queries: { amazon: "Mac Studio M3 Ultra" },
  },
  {
    id: "mac-studio-m1-max",
    name: "Mac Studio M1 Max",
    category: "apple",
    manufacturer: "Apple",
    appleChip: "m1max",
    applePage: "mac-studio",
    queries: { amazon: "Mac Studio M1 Max" },
  },
  {
    id: "mac-studio-m2-max",
    name: "Mac Studio M2 Max",
    category: "apple",
    manufacturer: "Apple",
    appleChip: "m2max",
    applePage: "mac-studio",
    queries: { amazon: "Mac Studio M2 Max" },
  },
  {
    id: "mac-studio-m1-ultra",
    name: "Mac Studio M1 Ultra",
    category: "apple",
    manufacturer: "Apple",
    appleChip: "m1ultra",
    applePage: "mac-studio",
    queries: { amazon: "Mac Studio M1 Ultra" },
  },
  {
    id: "mac-studio-m2-ultra",
    name: "Mac Studio M2 Ultra",
    category: "apple",
    manufacturer: "Apple",
    appleChip: "m2ultra",
    applePage: "mac-studio",
    queries: { amazon: "Mac Studio M2 Ultra" },
  },

  // ── Apple Silicon — Mac mini ───────────────────────────────────────────
  // Current-gen (new store): M4, M4 Pro
  {
    id: "mac-mini-m4",
    name: "Mac mini M4",
    category: "apple",
    manufacturer: "Apple",
    appleChip: "m4",
    applePage: "mac-mini",
    queries: { amazon: "Mac mini M4" },
  },
  {
    id: "mac-mini-m4-pro",
    name: "Mac mini M4 Pro",
    category: "apple",
    manufacturer: "Apple",
    appleChip: "m4pro",
    applePage: "mac-mini",
    queries: { amazon: "Mac mini M4 Pro" },
  },

  // ── Apple Silicon — MacBook Pro ────────────────────────────────────────
  // Current-gen (new store): M5, M5 Pro, M5 Max
  // Legacy (refurb/Amazon only): M1/M2/M3 Max
  {
    id: "macbook-pro-m5",
    name: "MacBook Pro M5",
    category: "apple",
    manufacturer: "Apple",
    appleChip: "m5",
    applePage: "macbook-pro",
    queries: { amazon: "MacBook Pro M5" },
  },
  {
    id: "macbook-pro-m5-pro",
    name: "MacBook Pro M5 Pro",
    category: "apple",
    manufacturer: "Apple",
    appleChip: "m5pro",
    applePage: "macbook-pro",
    queries: { amazon: "MacBook Pro M5 Pro" },
  },
  {
    id: "macbook-pro-m5-max",
    name: "MacBook Pro M5 Max",
    category: "apple",
    manufacturer: "Apple",
    appleChip: "m5max",
    applePage: "macbook-pro",
    queries: { amazon: "MacBook Pro M5 Max" },
  },
  {
    id: "macbook-pro-m4-pro",
    name: "MacBook Pro M4 Pro",
    category: "apple",
    manufacturer: "Apple",
    appleChip: "m4pro",
    applePage: "macbook-pro",
    queries: { amazon: "MacBook Pro M4 Pro" },
  },
  {
    id: "macbook-pro-m4-max",
    name: "MacBook Pro M4 Max",
    category: "apple",
    manufacturer: "Apple",
    appleChip: "m4max",
    applePage: "macbook-pro",
    queries: { amazon: "MacBook Pro M4 Max" },
  },
  {
    id: "macbook-pro-m3-max",
    name: "MacBook Pro M3 Max",
    category: "apple",
    manufacturer: "Apple",
    appleChip: "m3max",
    applePage: "macbook-pro",
    queries: { amazon: "MacBook Pro M3 Max" },
  },
  {
    id: "macbook-pro-m2-max",
    name: "MacBook Pro M2 Max",
    category: "apple",
    manufacturer: "Apple",
    appleChip: "m2max",
    applePage: "macbook-pro",
    queries: { amazon: "MacBook Pro M2 Max" },
  },
  {
    id: "macbook-pro-m1-max",
    name: "MacBook Pro M1 Max",
    category: "apple",
    manufacturer: "Apple",
    appleChip: "m1max",
    applePage: "macbook-pro",
    queries: { amazon: "MacBook Pro M1 Max" },
  },

  // ── AMD Strix Halo ─────────────────────────────────────────────────────
  {
    id: "amd-strix-halo-framework-desktop",
    name: "Framework Desktop (AMD Ryzen AI Max 395+)",
    category: "amd",
    manufacturer: "AMD / Framework",
    queries: { newegg: "Framework Desktop AMD Ryzen AI Max", amazon: "Framework Desktop Ryzen AI Max" },
  },
  {
    id: "amd-strix-halo-mini-pc",
    name: "Strix Halo Mini PC (Ryzen AI Max)",
    category: "amd",
    manufacturer: "AMD / Minisforum/GMKtec",
    queries: { newegg: "Ryzen AI Max mini PC", amazon: "Ryzen AI Max mini PC" },
  },

  // ── Memory ─────────────────────────────────────────────────────────────
  {
    id: "ddr5-32gb-5600",
    name: "32GB DDR5-5600 (2×16GB)",
    category: "memory",
    manufacturer: "Various",
    queries: { newegg: "DDR5-5600 32GB", amazon: "DDR5-5600 32GB kit", alternate: "DDR5-5600 32GB" },
  },
  {
    id: "ddr5-64gb-5600",
    name: "64GB DDR5-5600 (2×32GB)",
    category: "memory",
    manufacturer: "Various",
    queries: { newegg: "DDR5-5600 64GB", amazon: "DDR5-5600 64GB kit", alternate: "DDR5-5600 64GB" },
  },
  {
    id: "ddr4-32gb-3200",
    name: "32GB DDR4-3200 (2×16GB)",
    category: "memory",
    manufacturer: "Various",
    queries: { newegg: "DDR4-3200 32GB", amazon: "DDR4-3200 32GB kit", alternate: "DDR4-3200 32GB" },
  },
  {
    id: "ddr4-ecc-64gb",
    name: "64GB DDR4 ECC (Registered)",
    category: "memory",
    manufacturer: "Various",
    queries: { newegg: "DDR4 ECC 64GB registered", amazon: "DDR4 ECC 64GB RDIMM" },
  },
  {
    id: "ddr5-ecc-64gb",
    name: "64GB DDR5 ECC (Registered)",
    category: "memory",
    manufacturer: "Various",
    queries: { newegg: "DDR5 ECC 64GB RDIMM", amazon: "DDR5 ECC 64GB RDIMM" },
  },
];

/** Find a product by id. */
export function getProduct(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

/** Products filtered by category. */
export function productsByCategory(category: Product["category"]): Product[] {
  return PRODUCTS.filter((p) => p.category === category);
}

/** Apple products only (have appleChip/applePage). */
export function appleProducts(): AppleProduct[] {
  return PRODUCTS.filter((p) => p.appleChip && p.applePage);
}

/** Resolve the search query for a product on a given source (falls back to name). */
export function queryFor(product: Product, source: string): string {
  return product.queries[source] ?? product.name;
}
