import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { CACHE_TTL_MS, lookupCachedLink, pruneCache, withCachedLink } from "../src/lib/link-cache.ts";

const LINK = {
  shortUrl: "https://ishortn.ink/abc",
  alias: "abc",
  domain: "ishortn.ink",
  createdAt: "2026-11-24T10:00:00.000Z",
};
const URL_A = "https://example.com/a";
const T0 = 1_700_000_000_000;

describe("link cache", () => {
  it("returns a link cached for the same URL within 10 minutes", () => {
    const cache = withCachedLink(undefined, URL_A, LINK, T0);
    assert.deepEqual(lookupCachedLink(cache, URL_A, T0 + CACHE_TTL_MS - 1), { ...LINK, cachedAt: T0 });
  });

  it("expires at exactly 10 minutes", () => {
    const cache = withCachedLink(undefined, URL_A, LINK, T0);
    assert.equal(CACHE_TTL_MS, 600_000);
    assert.equal(lookupCachedLink(cache, URL_A, T0 + CACHE_TTL_MS), null);
  });

  it("matches the exact URL only", () => {
    const cache = withCachedLink(undefined, URL_A, LINK, T0);
    assert.equal(lookupCachedLink(cache, `${URL_A}#section`, T0), null);
    assert.equal(lookupCachedLink(undefined, URL_A, T0), null);
  });

  it("ignores entries from the future (clock changes)", () => {
    const cache = withCachedLink(undefined, URL_A, LINK, T0);
    assert.equal(lookupCachedLink(cache, URL_A, T0 - 1000), null);
  });

  it("replaces the entry for a URL and prunes expired ones on write", () => {
    let cache = withCachedLink(undefined, "https://old.example/", LINK, T0);
    cache = withCachedLink(cache, URL_A, LINK, T0 + CACHE_TTL_MS + 1);
    assert.deepEqual(Object.keys(cache), [URL_A]);

    const updated = withCachedLink(cache, URL_A, { ...LINK, alias: "custom" }, T0 + CACHE_TTL_MS + 2);
    assert.equal(updated[URL_A]?.alias, "custom");
  });

  it("pruneCache keeps only fresh entries", () => {
    const cache = {
      fresh: { ...LINK, cachedAt: T0 },
      stale: { ...LINK, cachedAt: T0 - CACHE_TTL_MS },
    };
    assert.deepEqual(Object.keys(pruneCache(cache, T0 + 1)), ["fresh"]);
  });
});
