/**
 * Cache layer — the scanner writes one JSON snapshot per scan, and the CLI's
 * `prices` command (and the website) read the most recent one.
 *
 * Layout under the cache directory (defaults to <cwd>/cache):
 *   latest.json          — the most recent successful snapshot (what the site reads)
 *   snapshot-<ts>.json   — timestamped archive of every scan
 *
 * The cache directory is configurable so library consumers can point it at a
 * writable location in their own project; the CLI's default of <cwd>/cache
 * keeps the in-workspace behavior unchanged. Snapshots are plain JSON so the
 * website can import them at build time or fetch them over HTTP without a
 * database. Reads validate against the Effect {@link PriceSnapshotSchema} so a
 * corrupt cache file fails loudly instead of silently propagating bad data.
 */
import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { PriceSnapshot } from "./types.js";
import { PriceSnapshotSchema } from "./types.js";
import { decode, runPromise } from "../lib/effect.js";

const LATEST_FILENAME = "latest.json";

/** Default cache directory, resolved from the current working directory.
 * A function (not a const) so the cwd is evaluated at call time — important
 * when this module is imported as a dependency and the caller's cwd differs
 * from the package's install location. */
export function defaultCacheDir(): string {
  return join(process.cwd(), "cache");
}

function latestPath(cacheDir: string): string {
  return join(cacheDir, LATEST_FILENAME);
}

/** Write a snapshot to disk: both an archive copy and the `latest.json` pointer.
 * Returns the archive path. */
export async function writeSnapshot(
  snapshot: PriceSnapshot,
  cacheDir: string = defaultCacheDir(),
): Promise<string> {
  await mkdir(cacheDir, { recursive: true });
  const stamp = snapshot.generatedAt.replace(/[:.]/g, "-");
  const archivePath = join(cacheDir, `snapshot-${stamp}.json`);
  const json = JSON.stringify(snapshot, null, 2);
  await writeFile(archivePath, json, "utf8");
  await writeFile(latestPath(cacheDir), json, "utf8");
  return archivePath;
}

/** Read the most recent snapshot, validated against the Effect schema.
 * Returns `null` if no cache file exists; throws {@link DecodeError} on a
 * corrupt file so callers can distinguish "no data yet" from "bad data". */
export async function readLatest(
  cacheDir: string = defaultCacheDir(),
): Promise<PriceSnapshot | null> {
  const path = latestPath(cacheDir);
  if (!existsSync(path)) return null;
  const raw = await readFile(path, "utf8");
  const parsed = JSON.parse(raw);
  const validated = await runPromise(
    decode(PriceSnapshotSchema, path)(parsed),
  );
  return validated as unknown as PriceSnapshot;
}

/** List all archived snapshots in `cacheDir`, newest first. */
export async function listSnapshots(
  cacheDir: string = defaultCacheDir(),
): Promise<string[]> {
  if (!existsSync(cacheDir)) return [];
  const files = await readdir(cacheDir);
  return files
    .filter((f) => f.startsWith("snapshot-"))
    .sort()
    .reverse();
}
