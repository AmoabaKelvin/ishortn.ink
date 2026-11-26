// bun scripts/build/dedupe-server-chunks.ts: runs after `next build` in the Worker build
// (buildCommand in open-next.config.ts).
//
// Turbopack writes byte-identical server chunks under a different name for each route that uses
// them (mysql2 + the Drizzle schema alone appear 15 times), and OpenNext bundles every chunk file
// into the Worker. That is about 20 MiB of duplicate code the Worker downloads and compiles on
// every cold start. Each duplicate is replaced with a stub that requires the first copy: chunk
// files only export their module factories (`module.exports=[id, factory, ...]`) and the Turbopack
// runtime installs a factory only for ids it hasn't seen, so sharing one array changes nothing.

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CHUNK_PREFIX = "module.exports=[";
const SOURCE_MAP_COMMENT = /\n\/\/# sourceMappingURL=[^\n]*\s*$/;

export type ChunkFile = { path: string; content: string };

/** Maps each duplicate chunk path to the path of the copy it should load instead. */
export function findDuplicateChunks(chunks: ChunkFile[]): Map<string, string> {
  const firstByHash = new Map<string, string>();
  const duplicates = new Map<string, string>();
  for (const chunk of [...chunks].sort((a, b) => a.path.localeCompare(b.path))) {
    // Anything else may run side effects on load, which a cached require would skip.
    if (!chunk.content.startsWith(CHUNK_PREFIX)) continue;
    const hash = createHash("sha256")
      .update(chunk.content.replace(SOURCE_MAP_COMMENT, ""))
      .digest("hex");
    const first = firstByHash.get(hash);
    if (first) duplicates.set(chunk.path, first);
    else firstByHash.set(hash, chunk.path);
  }
  return duplicates;
}

export function stubFor(duplicatePath: string, canonicalPath: string): string {
  const relative = path.posix.relative(path.posix.dirname(duplicatePath), canonicalPath);
  const specifier = relative.startsWith("../") ? relative : `./${relative}`;
  return `module.exports=require(${JSON.stringify(specifier)});\n`;
}

function listChunks(dir: string): ChunkFile[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(".js"))
    .map((file) => {
      const filePath = path.join(dir, file);
      return { path: filePath.split(path.sep).join("/"), content: readFileSync(filePath, "utf8") };
    });
}

export function dedupeChunkDir(dir: string) {
  const chunks = listChunks(dir);
  const sizes = new Map(chunks.map((chunk) => [chunk.path, Buffer.byteLength(chunk.content)]));
  let bytes = 0;
  const duplicates = findDuplicateChunks(chunks);
  for (const [duplicate, canonical] of duplicates) {
    const stub = stubFor(duplicate, canonical);
    writeFileSync(duplicate, stub);
    bytes += (sizes.get(duplicate) ?? 0) - stub.length;
  }
  return { files: duplicates.size, bytes };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  // OpenNext copies the server files from the standalone output, so dedupe both copies.
  for (const dir of [".next/server/chunks", ".next/standalone/.next/server/chunks"]) {
    const abs = path.join(root, dir);
    if (!existsSync(abs)) continue;
    const { files, bytes } = dedupeChunkDir(abs);
    console.info(
      `${dir}: replaced ${files} duplicate chunks (${(bytes / 2 ** 20).toFixed(1)} MiB)`,
    );
  }
}
