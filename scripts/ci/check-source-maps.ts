/**
 * Keeps the Worker's uploaded source maps under Cloudflare's 60 MiB limit (deploys fail with
 * API code 10021 above it).
 *
 *   bun scripts/ci/check-source-maps.ts [outdir]
 *
 * Passes when wrangler.jsonc sets `"upload_source_maps": false`. Otherwise sums the `.map`
 * files in `outdir` (from `wrangler deploy --dry-run --outdir <outdir>`) and fails above 50 MiB.
 * The `bun test` suite asserts the config, so CI catches uploads being re-enabled.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const WRANGLER_CONFIG_PATH = "wrangler.jsonc";
// Cloudflare rejects 60 MiB; the gap absorbs a few merges' growth before deploys break.
export const SOURCE_MAP_LIMIT_BYTES = 50 * 1024 * 1024;

// Wrangler uploads source maps unless the key is literally false. Comment lines are dropped so
// a commented-out setting doesn't count.
export function uploadsSourceMaps(wranglerJsonc: string): boolean {
  const code = wranglerJsonc
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n");
  return !/"upload_source_maps"\s*:\s*false\b/.test(code);
}

export function sourceMapBytes(dir: string): number {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) total += sourceMapBytes(path);
    else if (entry.name.endsWith(".map")) total += statSync(path).size;
  }
  return total;
}

const mib = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MiB`;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!uploadsSourceMaps(readFileSync(WRANGLER_CONFIG_PATH, "utf8"))) {
    console.log("Source maps are not uploaded (upload_source_maps is false).");
    process.exit(0);
  }
  const outdir = process.argv[2];
  if (!outdir) {
    console.error("Usage: check-source-maps.ts <wrangler --dry-run --outdir directory>");
    process.exit(2);
  }
  const total = sourceMapBytes(outdir);
  if (total > SOURCE_MAP_LIMIT_BYTES) {
    console.error(
      `Source maps total ${mib(total)}, over the ${mib(SOURCE_MAP_LIMIT_BYTES)} budget (Cloudflare rejects 60 MiB).`,
    );
    process.exit(1);
  }
  console.log(`Source maps total ${mib(total)} (budget ${mib(SOURCE_MAP_LIMIT_BYTES)}).`);
}
