import { loadSnapshot, listingsByCategory } from "../lib/data";
import { formatPrice, CATEGORY_LABELS, CATEGORY_COLORS } from "../lib/catalog";
import { Card } from "./components/ui/card";
import Link from "next/link";
import type { PriceListing } from "../../src/types";

export const revalidate = 3600;

export default async function HomePage() {
  const snapshot = await loadSnapshot();
  const products = [...new Set(snapshot.listings.map((l) => l.productId))];
  const retailers = [...new Set(snapshot.listings.map((l) => l.retailer))];
  const regions = [...new Set(snapshot.listings.map((l) => l.region.code))];
  const generated = new Date(snapshot.generatedAt).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  // Per-category summary (USD-preferred)
  const categories = ["gpu", "apple", "amd", "memory"];
  const catSummaries = categories.map((cat) => {
    const listings = snapshot.listings.filter((l) => l.category === cat);
    const byCur = new Map<string, PriceListing[]>();
    for (const l of listings) {
      const arr = byCur.get(l.currency) ?? [];
      arr.push(l);
      byCur.set(l.currency, arr);
    }
    let primaryCurrency = "USD";
    let primaryListings = byCur.get("USD") ?? [];
    let primaryNewCount = primaryListings.filter((l) => l.condition === "new").length;
    for (const [cur, group] of byCur) {
      const newCount = group.filter((l) => l.condition === "new").length;
      if (newCount > primaryNewCount) {
        primaryCurrency = cur;
        primaryListings = group;
        primaryNewCount = newCount;
      }
    }
    if (primaryListings.length === 0) {
      for (const [, group] of byCur) {
        if (group.length > primaryListings.length) primaryListings = group;
      }
    }
    const newPrices = primaryListings.filter((l) => l.condition === "new").map((l) => l.price);
    const low = newPrices.length ? Math.min(...newPrices) : null;
    const avg = newPrices.length ? newPrices.reduce((s, p) => s + p, 0) / newPrices.length : null;
    const catProducts = [...new Set(listings.map((l) => l.productId))];
    const catRetailers = [...new Set(listings.map((l) => l.retailer))];
    return { cat, listings, low, avg, catProducts, catRetailers, currency: primaryCurrency };
  });

  return (
    <div>
      {/* Hero */}
      <section className="pb-5 pt-2 md:pb-8 md:pt-4">
        <p className="k-smallcaps text-muted-foreground/70">Hardware price scanner</p>
        <h1 className="mt-2 max-w-4xl text-[2rem] font-medium leading-[1.05] tracking-tight md:text-5xl lg:text-6xl">
          Hardware prices,
          <br />
          <span className="text-muted-foreground">scanned.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
          Current market data for GPUs, Apple Silicon, AMD Strix Halo, and memory —
          pulled from Newegg, Amazon, Apple Store, Alternate.de, Minisforum,
          GMKtec, and Crucial. Prices vary by country, availability, condition,
          and retailer.
        </p>
      </section>

      {/* Stats strip — hairline border, no cards */}
      <section className="mb-8">
        <div className="grid grid-cols-2 border-y border-border sm:grid-cols-4">
          {[
            { label: "Listings", value: snapshot.listings.length.toLocaleString() },
            { label: "Products", value: products.length.toString() },
            { label: "Retailers", value: retailers.length.toString() },
            { label: "Regions", value: regions.length.toString() },
          ].map((stat) => (
            <div key={stat.label} className="px-1 py-3 sm:px-3">
              <p className="k-smallcaps text-muted-foreground/60">{stat.label}</p>
              <p className="k-data mt-0.5 text-lg font-medium tabular-nums text-foreground">{stat.value}</p>
            </div>
          ))}
        </div>
        <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground/50">
          Last scan: {generated}
          {snapshot.errors.length > 0 && ` · ${snapshot.errors.length} source errors`}
        </p>
      </section>

      {/* Category cards */}
      <section>
        <h2 className="text-lg font-medium tracking-tight">Price overview</h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Lowest and average new prices per category. Click through for per-product detail.
        </p>
        <div className="mt-5 grid gap-3 md:gap-4 xl:grid-cols-2">
          {catSummaries.map(({ cat, listings, low, avg, catProducts, catRetailers, currency }) => (
            <Link key={cat} href={`/${cat}`}>
              <Card className="flex flex-col gap-1 bg-card/40 p-4 transition-colors hover:bg-card/60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="size-3 rounded-[3px]"
                      style={{ background: CATEGORY_COLORS[cat] }}
                    />
                    <h3 className="text-[15px] font-semibold leading-5 tracking-tight">
                      {CATEGORY_LABELS[cat]}
                    </h3>
                  </div>
                  <span className="k-smallcaps text-muted-foreground/60">
                    {listings.length} listings
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div>
                    <p className="k-smallcaps text-muted-foreground/50">Low</p>
                    <p className="k-data mt-0.5 text-sm font-medium text-foreground">
                      {low ? formatPrice(low, currency) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="k-smallcaps text-muted-foreground/50">Average</p>
                    <p className="k-data mt-0.5 text-sm font-medium text-foreground">
                      {avg ? formatPrice(avg, currency) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="k-smallcaps text-muted-foreground/50">Sources</p>
                    <p className="k-data mt-0.5 text-sm font-medium text-foreground">
                      {catRetailers.length}
                    </p>
                  </div>
                </div>
                <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground/50">
                  {catProducts.length} products tracked
                </p>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
