import { describe, expect, test } from "bun:test";

import { normalizeTagName, normalizeTagNames } from "./utils";

describe("normalizeTagName", () => {
  test("trims and lowercases", () => {
    expect(normalizeTagName("  Marketing ")).toBe("marketing");
  });
});

describe("normalizeTagNames", () => {
  test("drops names that differ only in case or whitespace", () => {
    expect(normalizeTagNames(["marketing", "Marketing", " MARKETING ", "Sales"])).toEqual([
      "marketing",
      "sales",
    ]);
  });

  test("drops blank names", () => {
    expect(normalizeTagNames(["", "  ", "q4"])).toEqual(["q4"]);
  });
});
