"use client";
import * as React from "react";
import type { PriceSnapshot, PriceListing, ProductPriceSummary } from "../../../src/types";
import { PriceTable } from "./price-table";
import {
  PRODUCT_CATALOG,
  formatPrice,
  CATEGORY_LABELS,
  computeSummary,
  filterByRegion,
  retailerName,
} from "../../lib/catalog";
import { useRegion } from "./region-provider";
import { Card } from "./ui/card";

interface CategoryViewProps {
  category: string;
  snapshot: PriceSnapshot;
}

export function CategoryView({ category, snapshot }: CategoryViewProps) {
  const { region } = useRegion();

  const allListings = React.useMemo(
    () => snapshot.listings.filter((l) => l.category === category),
    [snapshot, category],
  );

  const regionListings = React.useMemo(
    () => filterByRegion(allListings, region),
    [allListings, region],
  );

  const productIds = React.useMemo(
    () => [...new Set(regionListings.map((l) => l.productId))],
    [regionListings],
  );

  const generated = new Date(snapshot.generatedAt).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  // Per-region stats
  const stats = React.useMemo(() => {
    const newPrices = regionListings
      .filter((l) => l.condition === "new")
      .map((l) => l.price);
    const currency = regionListings[0]?.currency ?? "USD";
    return {
      low: newPrices.length ? Math.min(...newPrices) : null,
      avg: newPrices.length
        ? newPrices.reduce((s, p) => s + p, 0) / newPrices.length
        : null,
      currency,
    };
  }, [regionListings]);

  const retailers = [...new Set(regionListings.map((l) => l.retailer))];
  const regions = [...new Set(allListings.map((l) => l.region.code))];

  return (
    <div>
      {/* Heading — editorial style */}
      <div className="mb-6">
        <p className="k-smallcaps text-muted-foreground/70">{CATEGORY_LABELS[category]}</p>
        <h1 className="mt-1 text-[2rem] font-medium leading-[1.05] tracking-tight md:text-3xl">
          {CATEGORY_LABELS[category]} prices
        </h1>
        <p className="mt-2 text-[13px] text-muted-foreground">
          {regionListings.length} listings from {retailers.length} retailers
          {region === "ALL" ? ` across ${regions.length} regions` : ` in ${region}`}
          <span className="font-mono text-[10px] uppercase tracking-[0.08em]"> · Last scan: {generated}</span>
        </p>
      </div>

      {/* Summary strip — hairline border, no cards */}
      <div className="mb-6 grid grid-cols-2 border-y border-border sm:grid-cols-4">
        <div className="px-1 py-3 sm:px-3">
          <p className="k-smallcaps text-muted-foreground/60">Lowest new</p>
          <p className="k-data mt-0.5 text-lg font-medium text-foreground">
            {stats.low ? formatPrice(stats.low, stats.currency) : "—"}
          </p>
        </div>
        <div className="px-1 py-3 sm:px-3">
          <p className="k-smallcaps text-muted-foreground/60">Average new</p>
          <p className="k-data mt-0.5 text-lg font-medium text-foreground">
            {stats.avg ? formatPrice(stats.avg, stats.currency) : "—"}
          </p>
        </div>
        <div className="px-1 py-3 sm:px-3">
          <p className="k-smallcaps text-muted-foreground/60">Products</p>
          <p className="k-data mt-0.5 text-lg font-medium text-foreground">{productIds.length}</p>
        </div>
        <div className="px-1 py-3 sm:px-3">
          <p className="k-smallcaps text-muted-foreground/60">Listings</p>
          <p className="k-data mt-0.5 text-lg font-medium text-foreground">{regionListings.length}</p>
        </div>
      </div>

      {/* Product tables */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {productIds.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-muted-foreground">
            No listings found for this category{region !== "ALL" ? ` in ${region}` : ""}.
          </div>
        ) : (
          productIds.map((pid) => {
            const meta = PRODUCT_CATALOG[pid] ?? { name: pid, manufacturer: "—", category };
            const listings = regionListings.filter((l) => l.productId === pid);
            const summary = computeSummary(pid, listings);
            return (
              <PriceTable
                key={pid}
                productId={pid}
                productName={meta.name}
                manufacturer={meta.manufacturer}
                category={meta.category}
                image={meta.image}
                listings={listings}
                summary={summary}
              />
            );
          })
        )}
      </div>

      {snapshot.errors.filter((e) => e.region).length > 0 && (
        <details className="mt-4 rounded-lg border border-border p-3">
          <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground/60">
            ⚠ {snapshot.errors.length} source errors during last scan
          </summary>
          <ul className="mt-2 space-y-0.5 font-mono text-[10px] text-muted-foreground/50">
            {snapshot.errors.map((e, i) => (
              <li key={i} className="k-data">
                {retailerName(e.retailer)}/{e.region}: {e.message}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
