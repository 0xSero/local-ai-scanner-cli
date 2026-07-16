"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../../lib/utils";
import { SearchDialog } from "./search-dialog";
import { RegionSelect } from "./region-select";
import { Button } from "./ui/button";
import type { PriceSnapshot } from "../../../src/types";

const NAV_ITEMS = [
  { href: "/", label: "Overview" },
  { href: "/gpu", label: "GPUs" },
  { href: "/apple", label: "Apple Silicon" },
  { href: "/amd", label: "AMD" },
  { href: "/memory", label: "Memory" },
];

export function TopNav({ snapshot }: { snapshot: PriceSnapshot | null }) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = React.useState(false);

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1480px] items-center gap-4 px-4 sm:px-6">
          {/* Logo — dot-triangle motif from local.ai */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <svg viewBox="0 0 22 22" className="size-[22px]" fill="none">
              <rect x="1" y="1" width="20" height="20" rx="4" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
              <circle cx="6" cy="16" r="1.7" fill="var(--hw-apple)" />
              <circle cx="11" cy="11" r="1.7" fill="var(--hw-gpu)" />
              <circle cx="16" cy="6" r="1.7" fill="var(--hw-amd)" />
              <path d="M6 16 L11 11 L16 6" stroke="currentColor" strokeWidth="0.6" strokeDasharray="2 2" opacity="0.4" />
            </svg>
            <span className="text-[13px] font-medium tracking-tight">Scanner</span>
          </Link>

          {/* Nav links */}
          <nav className="hidden items-center gap-0.5 sm:flex">
            {NAV_ITEMS.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-[13px] transition-colors",
                    active
                      ? "bg-accent font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/60",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Search + region */}
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="hidden h-8 w-[200px] justify-start gap-2 text-xs text-muted-foreground sm:flex"
              onClick={() => setSearchOpen(true)}
            >
              <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              Search products…
              <kbd className="ml-auto rounded border border-border px-1.5 py-0.5 text-[10px] font-mono">
                ⌘K
              </kbd>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 sm:hidden"
              onClick={() => setSearchOpen(true)}
            >
              <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </Button>
            <RegionSelect />
          </div>
        </div>
      </header>

      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} snapshot={snapshot} />
    </>
  );
}
