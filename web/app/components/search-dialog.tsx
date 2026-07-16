"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "./ui/command";
import { ALL_PRODUCTS, formatPrice, PRODUCT_CATALOG } from "../../lib/catalog";
import { HardwareImage } from "./hardware-image";
import type { PriceSnapshot, PriceListing } from "../../../src/types";
import { cn } from "../../lib/utils";

const CATEGORY_LABELS: Record<string, string> = {
  gpu: "GPU",
  apple: "Apple",
  amd: "AMD",
  memory: "Memory",
};

export function SearchDialog({
  open,
  onOpenChange,
  snapshot,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  snapshot: PriceSnapshot | null;
}) {
  const router = useRouter();

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (!open) return null;

  // Build per-product preview: cheapest 2 listings
  const listingPreview = React.useMemo(() => {
    if (!snapshot) return new Map<string, PriceListing[]>();
    const byProduct = new Map<string, PriceListing[]>();
    for (const l of snapshot.listings) {
      const arr = byProduct.get(l.productId) ?? [];
      arr.push(l);
      byProduct.set(l.productId, arr);
    }
    // Sort each product's listings by price and keep cheapest 2
    for (const [pid, listings] of byProduct) {
      byProduct.set(pid, [...listings].sort((a, b) => a.price - b.price).slice(0, 2));
    }
    return byProduct;
  }, [snapshot]);

  const grouped = ALL_PRODUCTS.reduce((acc, p) => {
    const key = p.category;
    (acc[key] ??= []).push(p);
    return acc;
  }, {} as Record<string, typeof ALL_PRODUCTS>);

  const handleSelect = (productId: string) => {
    const product = ALL_PRODUCTS.find((p) => p.id === productId);
    if (product) {
      router.push(`/${product.category}#${productId}`);
    }
    onOpenChange(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-[12vh]">
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative w-full max-w-xl" style={{ filter: "drop-shadow(0 24px 48px rgb(0 0 0 / 0.5))" }}>
        <Command className="border border-border shadow-2xl" loop>
          <CommandInput placeholder="Search GPUs, Apple Silicon, AMD, memory…" />
          <CommandList>
            <CommandEmpty>No products found.</CommandEmpty>
            {Object.entries(grouped).map(([cat, products]) => (
              <CommandGroup key={cat} heading={CATEGORY_LABELS[cat] ?? cat}>
                {products.map((p) => {
                  const previews = listingPreview.get(p.id) ?? [];
                  return (
                    <CommandItem
                      key={p.id}
                      value={`${p.name} ${p.manufacturer}`}
                      onSelect={() => handleSelect(p.id)}
                      className="gap-3 py-2"
                    >
                      <HardwareImage
                        src={p.image}
                        category={p.category}
                        alt={p.name}
                        className="h-8 w-11 rounded-md"
                      />
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="font-medium">{p.name}</span>
                        {previews.length > 0 && (
                          <div className="flex items-center gap-1.5">
                            {previews.map((l, i) => (
                              <span key={i} className="k-data text-[10px] text-muted-foreground">
                                {formatPrice(l.price, l.currency)}
                              </span>
                            ))}
                            <span className="k-smallcaps text-[9px] text-muted-foreground/50">
                              · {p.manufacturer}
                            </span>
                          </div>
                        )}
                        {previews.length === 0 && (
                          <span className="k-smallcaps text-[9px] text-muted-foreground/50">
                            {p.manufacturer}
                          </span>
                        )}
                      </div>
                      {previews.length > 0 && (
                        <span className="k-smallcaps shrink-0 text-[9px] text-muted-foreground/40">
                          {CATEGORY_LABELS[cat]}
                        </span>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
        <p className="mt-2 text-center text-xs text-muted-foreground/60">
          Press <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px]">Esc</kbd> to close
        </p>
      </div>
    </div>
  );
}
