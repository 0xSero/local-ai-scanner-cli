/**
 * Minimal HTTP fetch helper with a browser-ish user agent and simple retry.
 *
 * Many retailers block default Node fetch UA strings, so we send a desktop
 * Chrome UA. This is deliberately lightweight — no headless browser — because
 * the scanner is a cached batch job, not a live crawler. Sources that require
 * JS rendering or defeat this approach are marked as such in their source
 * module and skipped with a recorded error rather than crashing the scan.
 */
import type { SourceError } from "./types.js";

const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export interface FetchResult {
  ok: boolean;
  status: number;
  body: string;
  /** Final URL after redirects, for normalizing product links. */
  finalUrl: string;
}

/**
 * Fetch a URL as text with one retry on transient errors.
 *
 * Sends a full Chrome fingerprint (sec-ch-ua, sec-fetch-*) because eBay and
 * some other retailers 403 requests that lack these headers. The extra headers
 * are harmless to sites that don't check them.
 *
 * Some retailers (Amazon GB) gate search behind a WAF challenge that requires
 * a session cookie. Pass `cookies` to include a Cookie header.
 */
export async function fetchText(
  url: string,
  options?: { signal?: AbortSignal; cookies?: string },
): Promise<FetchResult> {
  const headers: Record<string, string> = {
    "User-Agent": DESKTOP_UA,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7",
    "Accept-Language": "en-US,en;q=0.9",
    "sec-ch-ua": '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": "none",
    "sec-fetch-user": "?1",
    "upgrade-insecure-requests": "1",
  };
  if (options?.cookies) {
    headers["Cookie"] = options.cookies;
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { headers, redirect: "follow", signal: options?.signal });
      const body = await res.text();
      return { ok: res.ok, status: res.status, body, finalUrl: res.url || url };
    } catch (err) {
      if (attempt === 1) {
        return { ok: false, status: 0, body: String(err), finalUrl: url };
      }
      await sleep(800);
    }
  }
  return { ok: false, status: 0, body: "unreachable", finalUrl: url };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Build a {@link SourceError} from a failed fetch. */
export function fetchError(retailer: string, region: string, result: FetchResult): SourceError {
  return {
    retailer,
    region,
    message: result.status === 0 ? `network error: ${result.body}` : `HTTP ${result.status}`,
  };
}
