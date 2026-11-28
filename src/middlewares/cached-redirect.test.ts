import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { hashIp } from "@/lib/utils/ip-hash";

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
const IP_HASH_SECRET = "test-ip-hash-secret-0123456789";

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

function visit(userAgent = BROWSER_UA, headers: Record<string, string> = {}) {
  return new Request("https://isht.app/launch", {
    headers: {
      host: "isht.app",
      "user-agent": userAgent,
      "cf-connecting-ip": "203.0.113.9",
      referer: "https://t.co/abc",
      ...headers,
    },
  });
}

async function redirectAndSettle(request = visit()) {
  const redirect = await redirectFromCache(request, TARGET, IP_HASH_SECRET);
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
      ipHash: hashIp("203.0.113.9", IP_HASH_SECRET),
    });
  });

  test("traffic sources without a referrer match the page's click", async () => {
    // A QR code's tracking link (contact cards included) is a scan; an in-app
    // browser names the app.
    cache(cachedLink({ isQrCode: true, url: "https://ishortn.ink/c/AbCdEfGhIjKl" }));
    const scan = await redirectAndSettle(
      new Request("https://isht.app/launch", {
        headers: { host: "isht.app", "user-agent": BROWSER_UA },
      }),
    );
    expect(scan?.response.headers.get("location")).toBe("https://ishortn.ink/c/AbCdEfGhIjKl");

    kv.clear();
    cache(cachedLink());
    await redirectAndSettle(
      new Request("https://isht.app/launch", {
        headers: {
          host: "isht.app",
          "user-agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0.0.0.0",
        },
      }),
    );

    expect(sent.map((event) => event.kind === "link" && event.referer)).toEqual([
      "qr",
      "instagram",
    ]);
  });

  test("a destination that isn't a valid Location header goes to Next without a click", async () => {
    cache(cachedLink({ url: "https://example.com/路径" }));

    expect(await redirectAndSettle()).toBeNull();
    expect(sent).toHaveLength(0);
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
      // A restricted or banned owner's links are blocked rows.
      { blocked: true, blockedReason: "Phishing" },
      { disabled: true, isQrCode: true, url: "https://ishortn.ink/c/AbCdEfGhIjKl" },
      { verifiedClicksEnabled: true, cloaking: true },
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

  test("loads without db, logger or env.mjs", async () => {
    // test/setup.ts stubs server-only and skips env validation, so this checks
    // the static import graph Wrangler bundles instead of loading it.
    const build = await Bun.build({
      entrypoints: ["src/middlewares/cached-redirect.ts"],
      target: "node",
      packages: "external",
      metafile: true,
    });
    const inputs = build.metafile?.inputs ?? {};
    const loaded = new Set<string>();
    const external = new Set<string>();
    const visit = (path: string) => {
      if (loaded.has(path)) return;
      loaded.add(path);
      for (const imported of inputs[path]?.imports ?? []) {
        // Dynamic imports (click-queue's dev-only inline ingest) load only when called.
        if (imported.kind === "dynamic-import") continue;
        if (imported.path in inputs) visit(imported.path);
        else external.add(imported.path);
      }
    };
    visit("src/middlewares/cached-redirect.ts");

    expect(loaded.size).toBeGreaterThan(3);
    for (const path of loaded) {
      expect(path).not.toMatch(/^src\/(env\.mjs|lib\/logger|server\/db)/);
    }
    for (const name of ["server-only", "pino", "drizzle-orm", "mysql2", "@t3-oss/env-nextjs"]) {
      expect(external.has(name)).toBe(false);
    }
  });
});
