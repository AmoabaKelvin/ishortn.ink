import { describe, expect, test } from "bun:test";

import { verdictCacheKey } from "./verdict-cache";

describe("verdictCacheKey", () => {
  test("shares a key across spellings of the same URL", () => {
    const key = verdictCacheKey("https://example.com/page?a=1");
    expect(verdictCacheKey("HTTPS://Example.COM:443/page?a=1")).toBe(key);
    expect(verdictCacheKey("https://example.com/page?a=1#section")).toBe(key);
  });

  test("keeps the path, query and scheme distinct", () => {
    const key = verdictCacheKey("https://example.com/page?a=1");
    expect(verdictCacheKey("https://example.com/other?a=1")).not.toBe(key);
    expect(verdictCacheKey("https://example.com/page?a=2")).not.toBe(key);
    expect(verdictCacheKey("http://example.com/page?a=1")).not.toBe(key);
  });

  test("does not store the URL in the key", () => {
    expect(verdictCacheKey("https://example.com/secret-path")).toMatch(
      /^phishing:llm-safe:[0-9a-f]{64}$/,
    );
  });
});
