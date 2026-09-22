import { expect, spyOn, test } from "bun:test";
import { ceneoSource } from "../src/sources/ceneo.js";
import type { Product } from "../src/types.js";

test("Ceneo preserves JSON-LD decimal prices and localized comma prices", async () => {
  const prices = ["1299.99", 1299.99, "1 299,99", "1.299,99", ".."];
  const html = `<script type="application/ld+json">${JSON.stringify({
    "@type": "ItemList",
    itemListElement: prices.map((lowPrice, index) => ({
      item: {
        "@type": "Product",
        name: `Fixture GPU ${index}`,
        offers: { lowPrice, offerCount: 1, priceCurrency: "PLN" },
      },
    })),
  })}</script>`;
  const fetch = spyOn(globalThis, "fetch").mockResolvedValue(new Response(html));
  try {
    const product: Product = { id: "fixture", name: "Fixture GPU", category: "gpu", queries: { ceneo: "Fixture GPU" } };
    const result = await ceneoSource.scan([product], { regionCode: "PL" });
    expect(result.errors).toEqual([]);
    expect(result.listings.map((listing) => listing.price)).toEqual(Array(4).fill(1299.99));
    expect(fetch).toHaveBeenCalledTimes(1);
  } finally {
    fetch.mockRestore();
  }
});
