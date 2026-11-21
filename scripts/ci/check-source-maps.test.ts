import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { sourceMapBytes, uploadsSourceMaps } from "./check-source-maps";

describe("uploadsSourceMaps", () => {
  test("the repo's wrangler.jsonc does not upload source maps", () => {
    // The bundled worker's map is over Cloudflare's 60 MiB limit, so uploading it fails deploys.
    expect(uploadsSourceMaps(readFileSync("wrangler.jsonc", "utf8"))).toBe(false);
  });

  test("uploads when the key is missing or true", () => {
    expect(uploadsSourceMaps(`{ "name": "ishortn" }`)).toBe(true);
    expect(uploadsSourceMaps(`{ "upload_source_maps": true }`)).toBe(true);
  });

  test("ignores a commented-out setting", () => {
    expect(uploadsSourceMaps(`{\n  // "upload_source_maps": false,\n}`)).toBe(true);
    expect(uploadsSourceMaps(`{\n  "upload_source_maps":false,\n}`)).toBe(false);
  });
});

describe("sourceMapBytes", () => {
  test("sums .map files recursively and skips everything else", () => {
    const dir = mkdtempSync(join(tmpdir(), "source-maps-"));
    try {
      mkdirSync(join(dir, "chunks"));
      writeFileSync(join(dir, "worker.js"), "x".repeat(100));
      writeFileSync(join(dir, "worker.js.map"), "x".repeat(30));
      writeFileSync(join(dir, "chunks", "a.js.map"), "x".repeat(12));
      expect(sourceMapBytes(dir)).toBe(42);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
