/**
 * Source registry — importing this module registers all source modules.
 * The CLI imports `"./sources/index.js"` once at startup to populate the
 * {@link SOURCES} map before scanning.
 */
import { registerSource } from "../source.js";
import { neweggSource } from "./newegg.js";
import { amazonSource } from "./amazon.js";
import { appleStoreSource } from "./apple-store.js";
import { appleRefurbishedSource } from "./apple-refurbished.js";
import { alternateSource } from "./alternate.js";
import { minisforumSource, gmktecSource } from "./shopify.js";
import { crucialSource } from "./crucial.js";
import { ebaySource } from "./ebay.js";
import { allegroSource } from "./allegro.js";
import { microcenterSource } from "./microcenter.js";
import { yodobashiSource } from "./yodobashi.js";
import { dosparaSource } from "./dospara.js";
import { awdItSource } from "./awd-it.js";
import { ceneoSource } from "./ceneo.js";

registerSource(neweggSource);
registerSource(amazonSource);
registerSource(appleStoreSource);
registerSource(appleRefurbishedSource);
registerSource(alternateSource);
registerSource(minisforumSource);
registerSource(gmktecSource);
registerSource(crucialSource);
registerSource(ebaySource);
registerSource(allegroSource);
registerSource(microcenterSource);
registerSource(yodobashiSource);
registerSource(dosparaSource);
registerSource(awdItSource);
registerSource(ceneoSource);
