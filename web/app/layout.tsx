import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TopNav } from "./components/top-nav";
import { RegionProvider } from "./components/region-provider";
import { loadSnapshot } from "../lib/data";

const sans = Geist({ variable: "--font-geist-sans", display: "swap", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", display: "swap", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Hardware Price Scanner — local.ai", template: "%s — local.ai" },
  description: "Live market prices for GPUs, Apple Silicon, AMD Strix Halo, and memory across US and global retailers.",
};

// Load the snapshot once at build time and pass it to the client TopNav
// so the search dialog can show listing previews without its own fetch.
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let snapshot = null;
  try {
    snapshot = await loadSnapshot();
  } catch {
    // Cache might not exist yet during first build — TopNav handles null
  }

  return (
    <html lang="en" className={`dark ${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <RegionProvider>
          <TopNav snapshot={snapshot} />
          <main className="mx-auto max-w-[1480px] px-3 py-8 sm:px-5 md:py-12">
            {children}
          </main>
          <footer className="border-t border-border">
            <div className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground/60">
                Hardware Price Scanner · Cached market data from Newegg, Amazon, Apple Store,
                Alternate.de, Minisforum, GMKtec, and Crucial
              </p>
            </div>
          </footer>
        </RegionProvider>
      </body>
    </html>
  );
}
