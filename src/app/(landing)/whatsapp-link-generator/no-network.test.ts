import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

// The page promises the number and message never leave the browser. Guard the tool's own source
// and the shared landing modules it pulls in against network calls, storage and server code.
const DIR = import.meta.dir;
const ENTRY_FILES = ["whatsapp-link-generator.tsx", "utils.ts", "copy.ts", "country-codes.ts"];
const FORBIDDEN = [
  "fetch(",
  "XMLHttpRequest",
  "sendBeacon",
  "WebSocket",
  "EventSource",
  "localStorage",
  "sessionStorage",
  "indexedDB",
  '"use server"',
  'from "@/trpc',
  'from "@/server',
];

const sharedImports = (file: string, source: string): string[] =>
  [...source.matchAll(/from "(\.\.\/_lib\/[^"]+)"/g)].map((match) =>
    join(dirname(file), `${match[1]}.ts`),
  );

const files = ENTRY_FILES.map((name) => join(DIR, name));
// Grows while iterating, so shared modules' own shared imports are checked too.
for (const file of files) {
  for (const shared of sharedImports(file, readFileSync(file, "utf8"))) {
    if (!files.includes(shared)) files.push(shared);
  }
}

describe("WhatsApp link generator stays in the browser", () => {
  it("checks the shared modules it imports", () => {
    expect(files.some((file) => file.includes("_lib"))).toBe(true);
  });

  for (const file of files) {
    it(`${file.slice(file.indexOf("(landing)"))} has no network, storage or server calls`, () => {
      const source = readFileSync(file, "utf8");
      for (const needle of FORBIDDEN) expect(source).not.toContain(needle);
    });
  }
});
