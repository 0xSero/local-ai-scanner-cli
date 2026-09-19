/**
 * Listing matcher tests against real retailer titles.
 *
 * The titles below were read from the retailers themselves (Amazon product pages,
 * the AWD-IT Magento search page, Apple's refurbished grid, Ceneo's JSON-LD).
 * Each rejected case is a listing that a plain word-presence test would accept:
 * the same Amazon ASIN is the lowest-priced "RTX 3060" and "RTX 3060 Ti"
 * listing, and "MacBook Pro M1 Pro" matched a base M1 machine because the
 * model name already supplied the word "Pro".
 *
 * Run with `bun test`.
 */
import { test, expect } from "bun:test";
import { titleMatches } from "../src/sources/listing-match.js";

// Real titles, verbatim.
const AMAZON_3060_TI =
  "Dell Gaming OEM Nvidia GeForce RTX 3060 Ti 8GB GDDR6 256-bit 14Gbps PCIe 4.0 x16 Graphics Video Card 0MTVG8 08GXMM (Renewed)";
const AMAZON_5060_TI =
  "ZOTAC Gaming GeForce RTX 5060 Ti 8GB Twin Edge OC DLSS 4 8GB GDDR7 128-bit 28 Gbps PCIE 5.0 Gaming Graphics Card, IceStorm 2.0 Cooling, SFF-Ready, ZT-B50610H-10A";
const AMAZON_M1 =
  "Apple 2020 MacBook Pro with M1 Chip, 13-inch, 8GB RAM, 256GB SSD, Silver (Renewed)";
const AMAZON_RAZER_5080 =
  'Razer Blade 16 (2026) Gaming Laptop, RTX 5080, 64GB DDR5, 1TB, Black | Intel Ultra 9 386H, 16" QHD+ 240Hz/0.2 ms OLED 16:10 Display, Wi-Fi 7, TB5, Windows 11';
const AWD_5060_TI_URL = "https://www.awd-it.co.uk/palit-geforce-rtx-5060-ti-dual-8g.html";
const AWD_5060_URL = "https://www.awd-it.co.uk/gigabyte-geforce-rtx-5060-oc-low-profile.html";
const AWD_RAM_2X16 =
  "Thermaltake TOUGHRAM RC D5 32GB (2x16GB) DDR5 5600MT/s C36 Memory - RA50D516GX2-5600C36A";
const AWD_RAM_1X32 = "Kingston Fury 32GB (1x32GB) 5600MT/s CL36 DDR5 RAM - Black - KF556R36RB-32";
const REFURB_M2_PRO =
  'Refurbished 14" MacBook Pro mit Apple M2 Pro Chip, 10‑Core CPU und 16‑Core GPU';
const REFURB_M2 = "Refurbished 13.3-inch MacBook Pro Apple M2 chip with 8-core CPU and 10-core GPU";
const REFURB_M5_PRO =
  "Refurbished 16-inch MacBook Pro Apple M5 Pro chip with 12-core CPU and 18-core GPU";

test("a base product does not claim its longer variants", () => {
  // The same ASIN is the lowest-priced 3060 and 3060 Ti listing.
  expect(titleMatches(AMAZON_3060_TI, "RTX 3060")).toBe(false);
  expect(titleMatches(AMAZON_5060_TI, "RTX 5060")).toBe(false);
  expect(titleMatches(AWD_5060_TI_URL, "RTX 5060")).toBe(false);
  expect(titleMatches("RTX 4080 Super 16GB", "RTX 4080")).toBe(false);
  expect(titleMatches("Radeon RX 7900 XTX 24GB", "RX 7900 XT")).toBe(false);
  expect(titleMatches("RTX 4090 Laptop 24GB", "RTX 4090")).toBe(false);
  expect(titleMatches(REFURB_M2_PRO, "MacBook Pro M2")).toBe(false);
});

test("a query ending in a variant word names model and variant together", () => {
  // "MacBook Pro M1 Pro" is satisfied by the model name's own "Pro".
  expect(titleMatches(AMAZON_M1, "MacBook Pro M1 Pro")).toBe(false);
  expect(titleMatches(REFURB_M2, "MacBook Pro M2 Pro")).toBe(false);
  expect(titleMatches(REFURB_M2_PRO, "MacBook Pro M2 Pro")).toBe(true);
  expect(titleMatches(REFURB_M5_PRO, "MacBook Pro M5 Pro")).toBe(true);
});

test("a listing that is the product the query names is kept", () => {
  expect(titleMatches(AMAZON_3060_TI, "RTX 3060 Ti")).toBe(true);
  expect(titleMatches(AMAZON_5060_TI, "RTX 5060 Ti")).toBe(true);
  expect(titleMatches(AWD_5060_TI_URL, "RTX 5060 Ti")).toBe(true);
  expect(titleMatches(AWD_5060_URL, "RTX 5060")).toBe(true);
  expect(titleMatches(AMAZON_M1, "MacBook Pro M1")).toBe(true);
  expect(titleMatches(REFURB_M2, "MacBook Pro M2")).toBe(true);
  expect(titleMatches(AMAZON_RAZER_5080, "Razer Blade 16 RTX 5080")).toBe(true);
});

test("a query word inside a longer word is not a variant", () => {
  // "16gb" sits inside the "2x16gb" kit size, which is the product.
  expect(titleMatches(AWD_RAM_2X16, "32GB DDR5-5600 (2×16GB)")).toBe(true);
  expect(titleMatches(AWD_RAM_1X32, "32GB DDR5-5600 (2×16GB)")).toBe(false);
});
