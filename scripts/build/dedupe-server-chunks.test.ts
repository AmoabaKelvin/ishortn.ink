import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";

import { dedupeChunkDir, findDuplicateChunks, stubFor } from "./dedupe-server-chunks";

const CHUNK = 'module.exports=[1,(e,t)=>{t.exports="db"}];';

describe("findDuplicateChunks", () => {
  test("points every copy at the first path, ignoring the source map comment", () => {
    const duplicates = findDuplicateChunks([
      { path: "chunks/_b._.js", content: `${CHUNK}\n\n//# sourceMappingURL=_b._.js.map` },
      { path: "chunks/_a._.js", content: `${CHUNK}\n\n//# sourceMappingURL=_a._.js.map` },
      { path: "chunks/ssr/_c._.js", content: `${CHUNK}\n\n//# sourceMappingURL=_c._.js.map` },
      { path: "chunks/_d._.js", content: 'module.exports=[2,(e,t)=>{t.exports="other"}];' },
    ]);
    expect(Object.fromEntries(duplicates)).toEqual({
      "chunks/_b._.js": "chunks/_a._.js",
      "chunks/ssr/_c._.js": "chunks/_a._.js",
    });
  });

  test("leaves files that aren't plain factory chunks alone", () => {
    const runtime = "var RUNTIME_PUBLIC_PATH = 'x';";
    expect(
      findDuplicateChunks([
        { path: "chunks/a.js", content: runtime },
        { path: "chunks/ssr/a.js", content: runtime },
      ]).size,
    ).toBe(0);
  });
});

describe("stubFor", () => {
  test("requires the canonical chunk by a relative path", () => {
    expect(stubFor("chunks/ssr/_c._.js", "chunks/_a._.js")).toBe(
      'module.exports=require("../_a._.js");\n',
    );
    expect(stubFor("chunks/_b._.js", "chunks/_a._.js")).toBe(
      'module.exports=require("./_a._.js");\n',
    );
  });
});

describe("dedupeChunkDir", () => {
  test("stubs resolve to the same module factories as the original", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "chunks-"));
    try {
      mkdirSync(path.join(dir, "ssr"));
      for (const file of ["_a._.js", "_b._.js", "ssr/_c._.js"]) {
        writeFileSync(path.join(dir, file), `${CHUNK}\n\n//# sourceMappingURL=${file}.map`);
      }

      expect(dedupeChunkDir(dir).files).toBe(2);
      expect(readFileSync(path.join(dir, "_a._.js"), "utf8")).toStartWith(CHUNK);

      const load = createRequire(path.join(dir, "index.js"));
      const original = load("./_a._.js");
      expect(load("./_b._.js")).toBe(original);
      expect(load("./ssr/_c._.js")).toBe(original);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
