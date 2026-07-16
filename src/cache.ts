/**
 * Cache layer — the scanner writes one JSON snapshot per scan, and the CLI's
 * `prices` command (and the website) read the most recent one.
 *
 * Layout under <package>/cache/:
 *   latest.json          — the most recent successful snapshot (what the site reads)
 *   snapshot-<ts>.json   — timestamped archive of every scan
 *
 * Snapshots are plain JSON so the website can import them at build time or
 * fetch them over HTTP without a database. Reads validate against the Effect
 * {@link PriceSnapshotSchema} so a corrupt cache file fails loudly instead of
 * silently propagating bad data.
 */
import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { PriceSnapshot } from "./types.js";
import { PriceSnapshotSchema } from "./types.js";
import { decode, runPromise } from "../lib/effect.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, "..", "cache");
const LATEST_PATH = join(CACHE_DIR, "latest.json");

/** Write a snapshot to disk: both an archive copy and the `latest.json` pointer. */
export async function writeSnapshot(snapshot: PriceSnapshot): Promise<string> {
  await mkdir(CACHE_DIR, { recursive: true });
  const stamp = snapshot.generatedAt.replace(/[:.]/g, "-");
  const archivePath = join(CACHE_DIR, `snapshot-${stamp}.json`);
  const json = JSON.stringify(snapshot, null, 2);
  await writeFile(archivePath, json, "utf8");
  await writeFile(LATEST_PATH, json, "utf8");
  return archivePath;
}

/** Read the most recent snapshot, validated against the Effect schema.
 * Returns `null` if no cache file exists; throws {@link DecodeError} on a
 * corrupt file so callers can distinguish "no data yet" from "bad data". */
export async function readLatest(): Promise<PriceSnapshot | null> {
  if (!existsSync(LATEST_PATH)) return null;
  const raw = await readFile(LATEST_PATH, "utf8");
  const parsed = JSON.parse(raw);
  const validated = await runPromise(
    decode(PriceSnapshotSchema, "cache/latest.json")(parsed),
  );
  return validated as unknown as PriceSnapshot;
}

/** List all archived snapshots, newest first. */
export async function listSnapshots(): Promise<string[]> {
  if (!existsSync(CACHE_DIR)) return [];
  const files = await readdir(CACHE_DIR);
  return files
    .filter((f) => f.startsWith("snapshot-"))
    .sort()
    .reverse();
}

export { CACHE_DIR };
