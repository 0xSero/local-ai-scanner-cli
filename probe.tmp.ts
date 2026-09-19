import "./src/sources/index.js";
import { runScan } from "./src/scan.js";
async function main() {
  for (const cat of ["gpu"] as const) {
    const snap = await runScan({ categories: [cat], regions: ["US", "PL", "JP"], onProgress: (e) => {
      if (e.phase === "done") console.log(`${e.region}/${e.source} listings=${e.listings} errors=${e.errors}`);
    }});
    const ids = ["h100", "h200", "a100", "gb200", "mi325x", "gaudi-3", "jetson-agx-thor", "rtx-4090-laptop", "l40s", "arc-b580"];
    const by: Record<string, string[]> = {};
    for (const l of snap.listings) {
      if (!ids.includes(l.productId)) continue;
      (by[l.productId] ??= []).push(`${l.region.code}/${l.retailer} ${l.price} ${l.currency} ${l.inStock ? "in" : "out"} ${l.url}`);
    }
    for (const id of ids) {
      console.log(`\n### ${id}`);
      for (const row of by[id] ?? ["(none)"]) console.log("   ", row.slice(0, 150));
    }
  }
}
main();
