#!/usr/bin/env bun
/**
 * `bunx` entry point — runs the CLI under Bun.
 *
 * `cli.ts` keeps its `tsx` shebang for in-workspace use (`npx tsx`,
 * `pnpm scan`); this thin entry lets the package declare a `bin` that targets
 * Bun instead. Importing `cli.ts` triggers its existing `main()` call, so this
 * file does nothing but load it.
 *
 * Usage:
 *   bunx local-ai-scanner-cli scan --category gpu
 *   bunx local-ai-scanner-cli prices --category gpu --region US
 *   bunx local-ai-scanner-cli sources
 */
import "./cli.js";
