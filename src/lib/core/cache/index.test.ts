import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { deleteGeoRulesFromCache, getGeoRulesFromCache, setGeoRulesInCache } from "./index";

import type { GeoRule } from "@/server/db/schema";

// OpenNext reads the request context from this global; getCloudflareEnv finds
// the KV binding there.
const CLOUDFLARE_CONTEXT = Symbol.for("__cloudflare-context__");
const LINK_ID = 7;

const kv = new Map<string, string>();

const rule: GeoRule = {
  id: 1,
  linkId: LINK_ID,
  type: "country",
  condition: "in",
  values: ["US"],
  action: "block",
  destination: null,
  blockMessage: null,
  priority: 0,
  createdAt: new Date("2026-11-01T00:00:00.000Z"),
};

describe("geo rules cache", () => {
  beforeAll(() => {
    Reflect.set(globalThis, CLOUDFLARE_CONTEXT, {
      env: {
        LINK_CACHE_KV: {
          get: async (key: string) => kv.get(key) ?? null,
          put: async (key: string, value: string) => {
            kv.set(key, value);
          },
          delete: async (key: string) => {
            kv.delete(key);
          },
        },
      },
      cf: {},
      ctx: { waitUntil: () => {} },
    });
  });

  beforeEach(() => {
    kv.clear();
  });

  afterAll(() => {
    Reflect.deleteProperty(globalThis, CLOUDFLARE_CONTEXT);
  });

  test("a read with no rules caches the empty list", async () => {
    expect(await setGeoRulesInCache(LINK_ID, [], Date.now())).toBe(true);
    expect(await getGeoRulesFromCache(LINK_ID)).toEqual([]);
  });

  test("a fill from a read taken before a rule write doesn't cache the stale list", async () => {
    // A click reads no rules, the owner adds the first rule and the write evicts the
    // key, then the click's background fill lands.
    const readAt = Date.now();
    await deleteGeoRulesFromCache(LINK_ID);

    expect(await setGeoRulesInCache(LINK_ID, [], readAt)).toBe(false);
    expect(await getGeoRulesFromCache(LINK_ID)).toBeNull();
  });

  test("a read taken well after the last rule write is cached", async () => {
    await deleteGeoRulesFromCache(LINK_ID);
    const readAt = Date.now() + 60_000;

    expect(await setGeoRulesInCache(LINK_ID, [rule], readAt)).toBe(true);
    expect((await getGeoRulesFromCache(LINK_ID))?.map((cached) => cached.id)).toEqual([rule.id]);
  });

  test("a rule write evicts the cached list", async () => {
    await setGeoRulesInCache(LINK_ID, [], Date.now());
    await deleteGeoRulesFromCache(LINK_ID);

    expect(await getGeoRulesFromCache(LINK_ID)).toBeNull();
  });
});
