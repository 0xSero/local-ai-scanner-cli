#!/usr/bin/env node
/**
 * CLI entry point — runs under Node (via `npx`/`npm`) or Bun (via `bunx`).
 * Both runtimes invoke the bin explicitly, so the shebang only matters for
 * direct execution; `node` is the maximally-compatible choice.
 *
 * `cli.ts` keeps its `tsx` shebang for in-workspace use (`npx tsx`,
 * `pnpm scan`). This thin entry lets the package declare a `bin` that targets
 * the published runtime instead. Importing `cli.ts` triggers its existing
 * `main()` call, so this file does nothing but load it.
 *
 * Usage:
 *   npx local-ai-scanner-cli scan --category gpu
 *   bunx local-ai-scanner-cli prices --category gpu --region US
 *   local-ai-scanner-cli sources
 */
import "./cli.js";
