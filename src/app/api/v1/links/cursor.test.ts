import { describe, expect, test } from "bun:test";

import { decodeLinkCursor, encodeLinkCursor } from "./cursor";

describe("link cursors", () => {
  test("round-trip the last row's createdAt and id", () => {
    const cursor = { createdAt: new Date("2026-11-21T10:15:30Z"), id: 4821 };
    expect(decodeLinkCursor(encodeLinkCursor(cursor))).toEqual(cursor);
  });

  test("round-trip a row without createdAt", () => {
    const cursor = { createdAt: null, id: 7 };
    expect(decodeLinkCursor(encodeLinkCursor(cursor))).toEqual(cursor);
  });

  test("encode to a URL-safe string", () => {
    const encoded = encodeLinkCursor({ createdAt: new Date(8_640_000_000_000), id: 2 ** 40 });
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  test("reject anything encodeLinkCursor can't produce", () => {
    for (const value of [
      "",
      "garbage",
      Buffer.from("1700000000000").toString("base64url"),
      Buffer.from("abc:12").toString("base64url"),
      Buffer.from("1700000000000:").toString("base64url"),
      Buffer.from("1700000000000:-1").toString("base64url"),
      Buffer.from(`1:${"9".repeat(20)}`).toString("base64url"),
      Buffer.from(`${"9".repeat(16)}:1`).toString("base64url"),
    ]) {
      expect(decodeLinkCursor(value)).toBeNull();
    }
  });
});
