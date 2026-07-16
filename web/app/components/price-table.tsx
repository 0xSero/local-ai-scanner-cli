/**
 * Price table — expandable rows for a single product, matching local-ai-web's
 * editorial catalog table aesthetic: hairline dividers, k-smallcaps headers,
 * k-data tabular-nums, hardware thumbnails, muted expansion wash.
 */
import type { PriceListing, ProductPriceSummary } from "../../../src/types";
import { formatPrice, retailerName, type ProductMeta } from "../../lib/catalog";
import { Badge } from "./ui/badge";
import { HardwareImage } from "./hardware-image";
import { cn } from "../../lib/utils";

interface PriceTableProps {
  productId: string;
  productName: string;
  manufacturer: string;
  category: string;
  image?: string;
  listings: PriceListing[];
  summary?: ProductPriceSummary;
}

function conditionBadge(condition: string) {
  const variant =
    condition === "new"
      ? "default"
      : condition === "refurbished"
        ? "secondary"
        : "outline";
  return <Badge variant={variant as "default" | "secondary" | "outline"}>{condition}</Badge>;
}

export function PriceTable({ productId, productName, manufacturer, category, image, listings, summary }: PriceTableProps) {
  if (listings.length === 0) return null;
  const sorted = [...listings].sort((a, b) => a.price - b.price);
  const sumCurrency = summary?.currency ?? sorted[0].currency;
  const primarySorted = sorted.filter((l) => l.currency === sumCurrency);
  const fallbackSorted = primarySorted.length > 0 ? primarySorted : sorted;
  const low = summary?.lowestNew ?? fallbackSorted[0]?.price ?? null;
  const high = summary?.highestNew ?? fallbackSorted[fallbackSorted.length - 1]?.price ?? null;

  // Show top 3 cheapest listings as preview chips in the collapsed row
  const previewListings = sorted.slice(0, 3);

  return (
    <details className="group border-b border-border/50 last:border-0" id={productId}>
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/20 sm:px-6 [&::-webkit-details-marker]:hidden">
        {/* Hardware thumbnail */}
        <HardwareImage
          src={image}
          category={category}
          alt={productName}
          className="h-10 w-14 rounded-md"
        />

        {/* Product name + preview listings */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="min-w-0">
            <span className="font-medium text-foreground">{productName}</span>
            <span className="k-smallcaps ml-2 text-muted-foreground/60">{manufacturer}</span>
          </div>
          {/* Inline preview of cheapest listings */}
          <div className="hidden items-center gap-1.5 lg:flex">
            {previewListings.map((l, i) => (
              <span key={i} className="k-data rounded-md border border-border/40 bg-secondary/30 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {formatPrice(l.price, l.currency)}
              </span>
            ))}
            {sorted.length > 3 && (
              <span className="k-smallcaps text-[10px] text-muted-foreground/50">
                +{sorted.length - 3}
              </span>
            )}
          </div>
        </div>

        {/* Price range */}
        <div className="k-data flex shrink-0 items-baseline gap-1 text-right">
          {low !== null && <span className="font-medium text-foreground">{formatPrice(low, sumCurrency)}</span>}
          {high !== null && high !== low && (
            <span className="text-muted-foreground/60 text-xs">– {formatPrice(high, sumCurrency)}</span>
          )}
        </div>

        {/* Retailer count */}
        <span className="k-smallcaps hidden w-24 shrink-0 text-right text-muted-foreground/50 xl:inline">
          {summary?.retailerCount ?? 0} ret · {listings.length} lst
        </span>
      </summary>

      {/* Expanded listing table */}
      <div className="border-t border-border/30 bg-muted/15 px-4 pb-3 pt-2 sm:px-6">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/40">
                <th className="k-smallcaps py-1.5 text-left text-muted-foreground/60">Retailer</th>
                <th className="k-smallcaps py-1.5 text-left text-muted-foreground/60">Region</th>
                <th className="k-smallcaps py-1.5 text-left text-muted-foreground/60">Condition</th>
                <th className="k-smallcaps py-1.5 text-right text-muted-foreground/60">Price</th>
                <th className="k-smallcaps py-1.5 text-center text-muted-foreground/60">Stock</th>
                <th className="k-smallcaps py-1.5 text-right text-muted-foreground/60">Qty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {sorted.map((l, i) => (
                <tr key={`${l.retailer}-${i}`} className="transition-colors hover:bg-muted/20">
                  <td className="py-1.5">
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-foreground/90 hover:text-primary"
                    >
                      {retailerName(l.retailer)}
                    </a>
                  </td>
                  <td className="k-data py-1.5 text-muted-foreground">{l.region.code}</td>
                  <td className="py-1.5">{conditionBadge(l.condition)}</td>
                  <td className="k-data py-1.5 text-right font-medium text-foreground">
                    {formatPrice(l.price, l.currency)}
                  </td>
                  <td className="py-1.5 text-center text-muted-foreground">
                    {l.inStock === true ? "✓" : l.inStock === false ? "○" : "—"}
                  </td>
                  <td className="k-data py-1.5 text-right text-muted-foreground">
                    {l.quantity !== null ? l.quantity : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {summary && (
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground">
            {summary.averageNew && (
              <span>avg <span className="k-data text-foreground/80">{formatPrice(summary.averageNew, sumCurrency)}</span></span>
            )}
            {summary.medianNew && (
              <span>median <span className="k-data text-foreground/80">{formatPrice(summary.medianNew, sumCurrency)}</span></span>
            )}
            {summary.lowestRefurbished && (
              <span>low refurb <span className="k-data text-foreground/80">{formatPrice(summary.lowestRefurbished, sumCurrency)}</span></span>
            )}
          </div>
        )}
      </div>
    </details>
  );
}
