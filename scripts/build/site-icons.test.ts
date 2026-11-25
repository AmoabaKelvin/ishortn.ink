import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { siteIconNames } from "@/app/(landing)/_components/site-icon";

import { buildSiteIconSprite, SPRITE_PATH } from "./site-icons";

describe("site icon sprite", () => {
  test("public/site-icons.svg is up to date (run bun scripts/build/site-icons.ts)", () => {
    expect(readFileSync(SPRITE_PATH, "utf8")).toBe(buildSiteIconSprite());
  });

  test("has one symbol per icon name", () => {
    const ids = [...buildSiteIconSprite().matchAll(/<symbol id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toEqual([...siteIconNames]);
  });
});
