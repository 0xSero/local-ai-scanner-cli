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

## Library usage

Install from npm (works with any runtime — Bun, Node ≥24, pnpm, yarn):

```bash
npm install local-ai-scanner-cli
# or
bun add local-ai-scanner-cli
```

The npm package ships compiled JavaScript (`dist/`) plus TypeScript types, so
it runs under Node without a build step. Under Bun you can also install
straight from GitHub (which serves the TypeScript source directly — Bun
resolves the internal `.js` import specifiers to their `.ts` files):

```bash
bun add local-ai-scanner-cli@github:0xSero/local-ai-scanner-cli
```

Importing the barrel registers all 15 retailer sources as a side effect, so
`runScan()` works without any setup.

```ts
import { runScan } from "local-ai-scanner-cli";

// Default: returns the snapshot in memory, writes nothing to disk.
const snapshot = await runScan({ categories: ["gpu"] });
console.log(snapshot.listings.length, "listings");

// Opt into persisting to a cache directory (defaults to <cwd>/cache):
await runScan({ categories: ["gpu"], persist: true });

// Persist to a custom location:
await runScan({ persist: true, cacheDir: "./my-cache" });

// Track progress as each source is hit (optional):
await runScan({
  categories: ["gpu"],
  onProgress: (e) => console.log(e.phase, e.region, e.source, e.listings ?? e.productCount),
});
```

The public API (re-exported from `src/index.ts`) covers the scan orchestrator,
cache read/write, product/region/source catalogs, aggregate stats, formatting,
and the Effect schemas:

```ts
import {
  runScan, readLatest, writeSnapshot, listSnapshots, defaultCacheDir,
  buildPriceEvolution,
  PRODUCTS, productsByCategory, REGIONS, allSources, summarizeAll,
  formatPrice, renderTable, PriceSnapshotSchema, ScanProgress,
} from "local-ai-scanner-cli";
```

> Note: `runScan()` hits live retailers over HTTP. For a no-network read of a
> cached snapshot, use `readLatest()` instead. Each fetch has a 15s timeout, so
> a hung source fails fast and is recorded in `snapshot.errors` rather than
> blocking the scan.

## CLI usage

Once installed, run the CLI without invoking `tsx` — `bunx` (Bun) or `npx`
(Node), or the bare binary if installed globally:

```bash
bunx local-ai-scanner-cli scan --category gpu
# or under Node:
npx local-ai-scanner-cli scan --category gpu
bunx local-ai-scanner-cli prices --category gpu --region US
bunx local-ai-scanner-cli sources
```

A `scan` writes to `./cache/latest.json` in the **current working directory**
(not inside `node_modules`), so it lands wherever you invoked the command. It
prints per-source progress as it goes — each retailer shows a `→` when it
starts, then `✓` with a listing count or `✗` with an error count:

```
⟳ Scanning gpu across US…
  → US/newegg (20 products)
  → US/amazon (20 products)
  → US/ebay (20 products)
  → US/microcenter (20 products)
  ✗ US/microcenter — 20 error(s)
  ✗ US/ebay — 20 error(s)
  ✗ US/newegg — 20 error(s)
  ✓ US/amazon — 29 listings
✓ 29 listings collected.
```

## Price history

`history` reads every cached snapshot (`cache/snapshot-*.json` archives plus
`latest.json`), sorts them oldest → newest, and prints a JSON report of how
each product's price changed between scans — absolute and percent deltas,
per currency. No network: it works purely off what's on disk.

```bash
# One-liner — print the evolution as JSON to stdout:
bunx local-ai-scanner-cli history

# Redirect to a file for analysis / diffing:
bunx local-ai-scanner-cli history > evolution.json

# Point at a non-default cache directory:
bunx local-ai-scanner-cli history --cacheDir ./my-cache > evolution.json
```

Each product gets one entry per snapshot that included it. Consecutive points
carry a `change` delta vs the prior point (same currency only — you can't diff
$1,599 against ¥899,800). The shape:

```json
{
  "generatedAt": "2026-07-21T13:21:26.666Z",
  "snapshotsAnalyzed": 2,
  "snapshotTimestamps": ["2026-07-16T14:36:41.620Z", "2026-07-21T13:21:26.666Z"],
  "products": {
    "rtx-4090": {
      "productId": "rtx-4090",
      "productName": "RTX 4090",
      "category": "gpu",
      "points": [
        {
          "snapshotAt": "2026-07-16T14:36:41.620Z",
          "currency": "USD",
          "lowestNew": 1599.99,
          "averageNew": 1799.99,
          "medianNew": 1749.99,
          "retailerCount": 5,
          "listingCount": 12
        },
        {
          "snapshotAt": "2026-07-21T13:21:26.666Z",
          "currency": "USD",
          "lowestNew": 1649.99,
          "averageNew": 1849.99,
          "medianNew": 1799.99,
          "retailerCount": 4,
          "listingCount": 9,
          "change": {
            "lowestNewDelta": 50.0,
            "averageNewDelta": 50.0,
            "lowestNewPct": 3.13,
            "averageNewPct": 2.78
          }
        }
      ]
    }
  }
}
```

The library API exposes the same thing — `buildPriceEvolution(cacheDir?)`
returns the typed report without printing:

```ts
import { buildPriceEvolution } from "local-ai-scanner-cli";
const evo = await buildPriceEvolution("./cache");
console.log(evo.snapshotsAnalyzed, "snapshots;", Object.keys(evo.products).length, "products tracked");
```

> Snapshots accumulate as you run `scan` (with `persist: true`, which the CLI
> does by default). The more scans you keep, the richer the evolution. Corrupt
> or schema-invalid archives are skipped rather than aborting the report.

## CLI commands

| Command | What it does |
| --- | --- |
| `scan [--category gpu,apple,amd,memory] [--region US,DE,GB,JP,PL]` | Fetches current prices from all sources and caches a snapshot |
| `prices [--category <c>] [--region <r>] [--condition new\|refurbished\|used]` | Prints prices from the cached snapshot (no network) |
| `export` | Exports the cached snapshot to `data/` as CSV + JSON |
| `sources` | Lists configured data sources |
| `history [--cacheDir <path>]` | Prints price evolution as JSON across all cached snapshots (no network) |

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

- **GPUs (20)**: RTX 5090–5070, RTX 4090–4060, RTX 3090–3060, RTX Pro 6000 Blackwell, RTX A6000, DGX Spark
- **Apple Silicon (16)**: Mac Studio (M1/M2 Max & Ultra, M3 Ultra, M4 Max), Mac mini M4/M4 Pro, MacBook Pro (M1–M5, Pro & Max tiers)
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
  cli.ts            # CLI entry point (scan / prices / sources) — tsx shebang
  bin.ts            # bunx entry point — Bun shebang, loads cli.ts
  index.ts          # Library barrel — re-exports the public API + registers sources
  sources/
    newegg.ts       amazon.ts         apple-store.ts
    apple-refurbished.ts  alternate.ts    shopify.ts
    crucial.ts      awd-it.ts         ceneo.ts
    dospara.ts      ebay.ts           allegro.ts
    microcenter.ts  yodobashi.ts      index.ts

lib/
  effect.ts         # Single entry point for Effect v4 (Schema, Effect, Data)

test/
  smoke.test.ts     # No-network barrel + catalog smoke test (bun test)

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
   products are fetched sequentially with a delay to be polite. Each fetch has
   a 15s timeout, so a source that hangs (WAF challenge, dropped socket) fails
   fast and is recorded in `snapshot.errors` instead of stalling the scan.
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

## Releases

Publishing to [npm](https://www.npmjs.com/package/local-ai-scanner-cli) is
automated by the `release.yml` GitHub Actions workflow. It has two jobs:

| Job | Trigger | What it does |
| --- | --- | --- |
| `release` | push to `main` | [semantic-release](https://semantic-release.gitbook.io/) reads [Conventional Commits](https://www.conventionalcommits.org/) since the last tag, computes the next version, bumps `package.json`, updates `CHANGELOG.md`, publishes to npm, and creates a GitHub release + tag. |
| `publish-current` | `workflow_dispatch` (manual) | Publishes whatever version is in `package.json` right now — no bump. Used to land the initial `0.1.0`. |

### Version bumps from commit messages

semantic-release uses the [angular](https://github.com/angular/angular/blob/main/CONTRIBUTING.md#commit) preset:

| Commit type | Bump |
| --- | --- |
| `feat:` | minor (`0.1.0` → `0.2.0`) |
| `fix:`, `perf:` | patch (`0.1.0` → `0.1.1`) |
| `feat!:`, `fix!:` (or `BREAKING CHANGE:` footer) | major (`0.1.0` → `1.0.0`) |
| `chore:`, `docs:`, `ci:`, `test:`, `refactor:`, `style:`, `build:` | none (no publish) |

So a merge to `main` containing only `docs:` commits publishes nothing; a
`feat:` merge publishes a new minor version automatically.

### One-time setup (npm token)

The npm account has 2FA enabled, which blocks non-interactive `npm publish`
with `E403`. The workflow authenticates via a granular access token with
2FA-bypass, stored as a repo secret so CI never hits the 2FA prompt:

1. **Create the token** — at
   [npmjs.com → Access Tokens](https://www.npmjs.com/settings/sero/tokens)
   (or your own account), create a **Granular Access Token**:
   - Allowed packages: `local-ai-scanner-cli`
   - Expiration: as long as you like (e.g. 1 year)
   - Permissions: **Read and write**
   - **Allow access via API / bypass 2FA** must be enabled for this token
     (this is what unblocks the CI publish)
2. **Add it as a GitHub secret** — in
   [repo Settings → Secrets and variables → Actions](https://github.com/0xSero/local-ai-scanner-cli/settings/secrets/actions),
   add a new repository secret named **`NPM_TOKEN`** with the token value.

The token is referenced by name in `release.yml` and never committed to the
repo. Rotate it by repeating the two steps above with a new token.

### First publish (0.1.0)

After the secret is in place, publish the initial `0.1.0` manually:

1. Go to
   [Actions → Release → Run workflow](https://github.com/0xSero/local-ai-scanner-cli/actions/workflows/release.yml)
2. Choose the `main` branch, click **Run workflow**
3. The `publish-current` job builds `dist/` and runs `npm publish --access public`

This lands `0.1.0` on npm immediately. Every subsequent `feat:`/`fix:` merge to
`main` then auto-publishes the next version via the `release` job.
