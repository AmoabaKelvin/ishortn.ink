import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { CACHED_REDIRECT_HEADERS, redirectFromCache } from "./cached-redirect";

import type { ClickEvent } from "@/lib/core/analytics/click-event";
import type { Link } from "@/lib/core/cache";
import type { GeoRule } from "@/server/db/schema";

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// OpenNext reads the request context from this global; the cache and queue
// helpers find their bindings there.
const CLOUDFLARE_CONTEXT = Symbol.for("__cloudflare-context__");
const TARGET = { domain: "isht.app", alias: "launch" };
const LINK_ID = 41;

const kv = new Map<string, string>();
let sent: ClickEvent[] = [];

// setInCache stores JSON.stringify(link), so dates arrive as ISO strings.
function cachedLink(overrides: Partial<Link> = {}): Link {
  return {
    id: LINK_ID,
    name: null,
    url: "https://example.com/landing",
    alias: "launch",
    domain: "isht.app",
    createdAt: new Date("2026-11-01T00:00:00.000Z"),
    disableLinkAfterClicks: null,
    clickLimitCount: null,
    disableLinkAfterDate: null,
    activateAt: null,
    disabled: false,
    publicStats: false,
    userId: "user_owner",
    teamId: null,
    createdByUserId: null,
    passwordHash: null,
    note: null,
    metadata: null,
    utmParams: null,
    tags: null,
    archived: false,
    folderId: null,
    campaignId: null,
    cloaking: false,
    verifiedClicksEnabled: false,
    isQrCode: false,
    isBioLink: false,
    blocked: false,
    blockedAt: null,
    blockedReason: null,
    statsShareToken: null,
    statsSharedAt: null,
    ...overrides,
  };
}

function cache(link: Link, rules: GeoRule[] | null = []) {
  kv.set(`${TARGET.domain}:${TARGET.alias}`, JSON.stringify(link));
  if (rules) kv.set(`geoRules:${link.id}`, JSON.stringify(rules));
}

function visit(userAgent = BROWSER_UA) {
  return new Request("https://isht.app/launch", {
    headers: {
      host: "isht.app",
      "user-agent": userAgent,
      "cf-connecting-ip": "203.0.113.9",
      referer: "https://t.co/abc",
    },
  });
}

async function redirectAndSettle(request = visit()) {
  const redirect = await redirectFromCache(request, TARGET);
  await redirect?.click;
  return redirect;
}

describe("redirectFromCache", () => {
  beforeAll(() => {
    Reflect.set(globalThis, CLOUDFLARE_CONTEXT, {
      env: {
        LINK_CACHE_KV: { get: async (key: string) => kv.get(key) ?? null },
        CLICK_QUEUE: {
          send: async (event: ClickEvent) => {
            sent.push(event);
          },
        },
      },
      cf: { country: "GH", city: "Accra" },
      ctx: { waitUntil: () => {} },
    });
  });

  beforeEach(() => {
    kv.clear();
    sent = [];
  });

  afterAll(() => {
    Reflect.deleteProperty(globalThis, CLOUDFLARE_CONTEXT);
  });

  test("a cached plain link redirects with a 307 and queues one click", async () => {
    cache(cachedLink());

    const redirect = await redirectAndSettle();

    expect(redirect?.response.status).toBe(307);
    expect(redirect?.response.headers.get("location")).toBe("https://example.com/landing");
    expect(redirect?.response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(redirect?.response.headers.get("cache-control")).toContain("no-store");
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      kind: "link",
      linkId: LINK_ID,
      ownerId: "user_owner",
      matchedGeoRuleId: null,
      countsTowardLimit: false,
      country: "Ghana",
      city: "Accra",
      referer: "twitter",
    });
  });

  test("UTM parameters are added to the destination", async () => {
    cache(cachedLink({ utmParams: { utm_source: "newsletter", utm_campaign: "" } }));

    const redirect = await redirectAndSettle();

    expect(redirect?.response.headers.get("location")).toBe(
      "https://example.com/landing?utm_source=newsletter",
    );
  });

  test("bots are redirected without a click", async () => {
    cache(cachedLink());

    const redirect = await redirectAndSettle(
      visit("Googlebot/2.1 (+http://www.google.com/bot.html)"),
    );

    expect(redirect?.response.status).toBe(307);
    expect(sent).toHaveLength(0);
  });

  test("a cache miss on the link or its rules goes to Next", async () => {
    expect(await redirectAndSettle()).toBeNull();

    cache(cachedLink(), null);
    expect(await redirectAndSettle()).toBeNull();
    expect(sent).toHaveLength(0);
  });

  test("links with targeting rules go to Next", async () => {
    cache(cachedLink(), [
      {
        id: 1,
        linkId: LINK_ID,
        type: "country",
        condition: "in",
        values: ["US"],
        action: "redirect",
        destination: "https://example.com/us",
        blockMessage: null,
        priority: 0,
        createdAt: new Date("2026-11-01T00:00:00.000Z"),
      },
    ]);

    expect(await redirectAndSettle()).toBeNull();
    expect(sent).toHaveLength(0);
  });

  test("links that need more than the cached row go to Next without a click", async () => {
    const past = new Date("2026-01-01T00:00:00.000Z");
    const future = new Date("2999-01-01T00:00:00.000Z");
    for (const overrides of [
      { blocked: true },
      { disabled: true },
      { passwordHash: "hash" },
      { cloaking: true },
      { verifiedClicksEnabled: true },
      { disableLinkAfterClicks: 100 },
      { disableLinkAfterDate: past },
      { activateAt: future },
      { url: null },
      { url: "javascript:alert(1)" },
      { url: "/relative" },
    ]) {
      kv.clear();
      cache(cachedLink(overrides));
      expect(await redirectAndSettle()).toBeNull();
    }
    expect(sent).toHaveLength(0);
  });

  test("a future disable date or a past activation still redirects", async () => {
    cache(
      cachedLink({
        disableLinkAfterDate: new Date("2999-01-01T00:00:00.000Z"),
        activateAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
    );

    expect((await redirectAndSettle())?.response.status).toBe(307);
  });

  test("the redirect carries next.config.js's site-wide headers", async () => {
    const config = (await import("../../next.config.js")).default;
    const rules: { source: string; headers: { key: string; value: string }[] }[] =
      await config.headers();
    const siteWide = rules.find((rule) => rule.source === "/(.*)");
    expect(siteWide).toBeDefined();
    for (const { key, value } of siteWide?.headers ?? []) {
      expect(new Headers(CACHED_REDIRECT_HEADERS).get(key)).toBe(value);
    }
  });
});
