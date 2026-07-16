# local-ai-scanner-cli

Cached hardware price scanner for [local.ai](https://local.ai). Pulls current
market prices for GPUs, Apple Silicon, AMD Strix Halo, and memory across 5
regions and 15 retailers, caches them as a JSON snapshot, and serves a matching
Next.js website. Data is exported as CSV + JSON for exploration.

## Quick start

```bash
# From the repo root (pnpm workspace)
pnpm install

# Scan all categories across all regions — writes cache/latest.json
cd local-ai-scanner-cli
npx tsx src/cli.ts scan

# Export data as CSV + JSON for exploration
npx tsx src/export-data.ts

# View cached prices (no network)
npx tsx src/cli.ts prices --category gpu
npx tsx src/cli.ts prices --category gpu --region US
npx tsx src/cli.ts prices --condition refurbished

# List configured sources
npx tsx src/cli.ts sources

# Run the website
cd web
npx next dev --port 3001
```

## CLI commands

| Command | What it does |
| --- | --- |
| `scan [--category gpu,apple,amd,memory] [--region US,DE,GB,JP,PL]` | Fetches current prices from all sources and caches a snapshot |
| `prices [--category <c>] [--region <r>] [--condition new\|refurbished\|used]` | Prints prices from the cached snapshot (no network) |
| `export` | Exports the cached snapshot to `data/` as CSV + JSON |
| `sources` | Lists configured data sources |

## Data exports

`pnpm export` writes flat CSV + JSON files to `data/` for exploration:

| File | Format | Contents |
| --- | --- | --- |
| `data/listings.csv` | CSV | All raw listings (product, retailer, region, price, stock, quantity) |
| `data/listings.json` | JSON | Same data, pretty-printed |
| `data/summaries.csv` | CSV | Per-product aggregate stats (low/high/avg/median, retailer count) |
| `data/summaries.json` | JSON | Same data, pretty-printed |
| `data/errors.csv` | CSV | Source errors from the last scan (retailer, region, message) |
| `data/errors.json` | JSON | Same data, pretty-printed |
| `data/snapshot.json` | JSON | Full snapshot (listings + summaries + errors) |

## Data sources

15 sources across 5 regions, accessed via plain HTTP GET (no API keys, no
headless browser). Sources that block plain HTTP (eBay, Allegro, Micro Center,
Newegg) are tracked and attempted every scan — failures are recorded in the
snapshot's `errors` array.

| Source | Region | Categories | Method |
| --- | --- | --- | --- |
| **Newegg** | US | GPU, memory, AMD | Embedded `window.__initialState__` JSON |
| **Amazon** | US, DE, GB, JP, PL | All | HTML scraping with session cookies for currency |
| **Apple Store (new)** | US, DE, GB, JP, PL | Apple | Embedded chip-keyed price JSON on buy pages |
| **Apple Refurbished** | US, DE, GB, JP, PL | Apple | Schema.org JSON-LD `Product` nodes |
| **Alternate.de** | DE | GPU, memory | HTML scraping (`.price` spans, German format) |
| **Minisforum Store** | US | AMD | Shopify `/products.json` |
| **GMKtec Store** | US | AMD | Shopify `/products.json` |
| **Crucial.com** | US, GB, DE, PL, JP | Memory | JSON-LD on product pages |
| **AWD-IT** | GB | GPU, memory, AMD | Magento 2 HTML scraping (`.product-item`) |
| **Ceneo** | PL | All | JSON-LD `ItemList` (price comparison aggregator) |
| **Dospara** | JP | GPU, memory | Salesforce Commerce Cloud HTML scraping |
| **eBay** | US, DE, GB, PL | All | HTML scraping (blocked by JS challenge) |
| **Allegro** | PL | All | HTML scraping (blocked by DataDome) |
| **Micro Center** | US | All | HTML scraping (blocked by Cloudflare Turnstile) |
| **Yodobashi** | JP | All | HTML scraping (blocked at network level) |

## Regions

| Region | Currency | Tracked suppliers |
| --- | --- | --- |
| **US** | USD | 9 (newegg, amazon, ebay, microcenter, apple-store, apple-refurbished, minisforum, gmktec, crucial) |
| **DE** | EUR | 6 (alternate, amazon, ebay, apple-store, apple-refurbished, crucial) |
| **GB** | GBP | 6 (amazon, ebay, apple-store, apple-refurbished, crucial, awd-it) |
| **JP** | JPY | 6 (amazon, apple-store, apple-refurbished, yodobashi, dospara, crucial) |
| **PL** | PLN | 7 (allegro, amazon, ebay, apple-store, apple-refurbished, crucial, ceneo) |

## Products tracked

43 products across 4 categories:

- **GPUs (21)**: RTX 5090–5070, RTX 4090–4060, RTX 3090–3060, RTX Pro 6000 Blackwell, RTX A6000, DGX Spark
- **Apple Silicon (12)**: Mac Studio M1/M2/M3/M4, Mac mini M4/M4 Pro, MacBook Pro M1–M5
- **AMD (2)**: Framework Desktop (Ryzen AI Max 395+), Strix Halo Mini PC
- **Memory (5)**: DDR5-5600 32/64GB, DDR4-3200 32GB, DDR4/DDR5 ECC 64GB RDIMM

## Architecture

```
src/
  types.ts          # Domain types + Effect v4 Schema definitions
  products.ts       # Product catalog (43 products, 4 categories)
  regions.ts        # Region definitions (5 regions with source mapping)
  source.ts         # Source interface + registry
  scan.ts           # Scan orchestrator (runs sources, builds snapshot)
  stats.ts          # Per-product aggregate stats (per-currency)
  cache.ts          # Snapshot read/write (Effect schema-validated)
  http.ts           # HTTP fetch helper (desktop UA, retry)
  format.ts         # CLI table + currency formatting
  export-data.ts    # Export to data/ as CSV + JSON
  cli.ts            # CLI entry point (scan / prices / sources)
  sources/
    newegg.ts       amazon.ts         apple-store.ts
    apple-refurbished.ts  alternate.ts    shopify.ts
    crucial.ts      awd-it.ts         ceneo.ts
    dospara.ts      ebay.ts           allegro.ts
    microcenter.ts  yodobashi.ts      index.ts

lib/
  effect.ts         # Single entry point for Effect v4 (Schema, Effect, Data)

cache/
  latest.json       # Most recent snapshot (read by the website)

data/               # Exported CSV + JSON for exploration
  listings.csv      listings.json
  summaries.csv     summaries.json
  errors.csv        errors.json
  snapshot.json

web/                # Next.js display site (local-ai-web design language)
  app/              # App Router pages (home + 4 category pages)
  lib/catalog.ts    # Product catalog mirror + formatting helpers
  lib/data.ts       # Loads cache for server-side rendering
```

## How it works

1. `scan` runs all registered sources for each region in parallel. Within a
   region, sources run concurrently (different hosts); within a source,
   products are fetched sequentially with a delay to be polite.
2. Each source normalizes its results into `PriceListing` rows tagged with
   product, retailer, region, condition, price, currency, stock status, and
   quantity (units available).
3. `stats.ts` computes per-product aggregates (low/high/mean/median) grouped
   by currency — mixing USD and JPY in one average would be meaningless.
4. The full snapshot (listings + summaries + errors) is written to
   `cache/latest.json`, validated against Effect v4 Schemas on read.
5. `export` flattens the snapshot to CSV + JSON in `data/`.
6. The website reads `cache/latest.json` at build time and renders price
   tables with the local-ai-web design system (Tailwind v4, oklch tokens,
   expandable `<details>` rows, mono-smallcaps eyebrows).

Prices are never converted across currencies. Each listing keeps its native
currency so the display reflects what the retailer actually charges.

## Effect v4

Runtime validation uses Effect `Schema` (pinned `effect@4.0.0-beta.92`). All
Effect imports go through `lib/effect.ts` — never import `"effect"` directly.
The `PriceSnapshotSchema` validates every cache read so a corrupt file fails
loudly instead of silently propagating bad data.
