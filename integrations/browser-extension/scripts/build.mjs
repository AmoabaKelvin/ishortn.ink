import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

import { EXPECTED_PERMISSIONS, buildManifest } from "./manifest.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));

const baseUrl = (process.env.ISHORTN_BASE_URL || "https://ishortn.ink").replace(/\/+$/, "");
try {
  const parsed = new URL(baseUrl);
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
    throw new Error("must use https outside localhost");
  }
} catch (error) {
  console.error(`Invalid ISHORTN_BASE_URL "${baseUrl}": ${error.message}`);
  process.exit(1);
}

const stage = join(dist, ".stage");
await rm(dist, { recursive: true, force: true });
await mkdir(stage, { recursive: true });

await build({
  entryPoints: { popup: join(root, "src/popup.ts"), background: join(root, "src/background.ts") },
  outdir: stage,
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["chrome110", "firefox115"],
  minify: true,
  legalComments: "eof",
  sourcemap: false,
  define: { __ISHORTN_BASE_URL__: JSON.stringify(baseUrl) },
  logLevel: "warning",
});

await cp(join(root, "src/popup.html"), join(stage, "popup.html"));
await cp(join(root, "src/popup.css"), join(stage, "popup.css"));
await cp(join(root, "icons"), join(stage, "icons"), {
  recursive: true,
  filter: (src) => !src.endsWith(".svg"),
});

for (const target of ["chrome", "firefox"]) {
  const out = join(dist, target);
  await cp(stage, out, { recursive: true });
  const manifest = buildManifest(target, {
    version: pkg.version,
    key: process.env.ISHORTN_EXTENSION_KEY || undefined,
  });
  if (JSON.stringify(manifest.permissions) !== JSON.stringify(EXPECTED_PERMISSIONS)) {
    throw new Error(`Unexpected permissions in ${target} manifest`);
  }
  await writeFile(join(out, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}
await rm(stage, { recursive: true, force: true });

console.log(`Built dist/chrome and dist/firefox (v${pkg.version}, base ${baseUrl})`);
