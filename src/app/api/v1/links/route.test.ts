import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import crypto from "node:crypto";

import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

import { env } from "@/env.mjs";
import { PLAN_VARIANT_IDS } from "@/lib/billing/plans";
import { ACCOUNT_RESTRICTED_MESSAGE } from "@/lib/constants/moderation";
import { INVALID_URL_MESSAGE } from "@/lib/utils/destination-url";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { assertUrlSafeFast, checkUrlWithLlm, USER_MSG_UNSAFE } from "@/server/lib/phishing";
import { monthlyLinkLimitMessage } from "@/server/lib/user-plan";

import { authenticateToken } from "../utils";
import { PATCH } from "./[alias]/route";
import { createTokenLink } from "./create";
import { POST } from "./route";

import type { TokenLinkDeps } from "./create";

// Runs against a disposable MySQL with the schema pushed (test/setup.ts points
// the app's db client at it); see CONTRIBUTING.md, "Database tests".
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("POST /api/v1/links (MySQL)", () => {
  const USER_ID = "api_links_route_test";
  const API_KEY = "api-links-route-test-key";
  // localhost is refused by the metadata scraper, so the URL safety check
  // fails open without any network call.
  const TARGET_URL = "http://localhost/route-test";

  beforeAll(() => {
    // Another test file replaces @/env.mjs with a partial object for the whole
    // run, dropping DATABASE_URL; the app's db client reads it on first use.
    if (!env.DATABASE_URL) Object.assign(env, { DATABASE_URL: testDatabaseUrl });
  });

  async function reset(monthlyLinkCount: number, restrictedAt: Date | null = null) {
    await db.delete(schema.subscription).where(eq(schema.subscription.userId, USER_ID));
    await db.delete(schema.link).where(eq(schema.link.userId, USER_ID));
    await db.delete(schema.token).where(eq(schema.token.userId, USER_ID));
    await db.delete(schema.user).where(eq(schema.user.id, USER_ID));
    await db.insert(schema.user).values({
      id: USER_ID,
      monthlyLinkCount,
      lastLinkCountReset: new Date(),
      restrictedAt,
      // Checked already, so the first-request plan check doesn't start a grace (and send its
      // email through waitUntil, which needs the Worker context) for past_due subscribers.
      planCheckedAt: new Date(),
    });
    await db.insert(schema.token).values({
      userId: USER_ID,
      token: crypto.createHash("sha256").update(API_KEY).digest("hex"),
    });
  }

  function subscribe(values: Partial<typeof schema.subscription.$inferInsert>) {
    return db.insert(schema.subscription).values({
      userId: USER_ID,
      plan: "pro",
      variantId: PLAN_VARIANT_IDS.pro.monthly,
      ...values,
    });
  }

  function createLink(
    body: { alias?: string; password?: string; utmParams?: { utm_source?: string } } = {},
  ) {
    return POST(
      new Request("http://localhost/api/v1/links", {
        method: "POST",
        headers: { "x-api-key": API_KEY, "content-type": "application/json" },
        body: JSON.stringify({ url: TARGET_URL, ...body }),
      }),
    );
  }

  async function storedCount() {
    const row = await db.query.user.findFirst({ where: eq(schema.user.id, USER_ID) });
    return row?.monthlyLinkCount;
  }

  beforeEach(() => reset(0));

  const BLOCKED_HOST = "route-test-blocked.example";

  afterAll(async () => {
    await db.delete(schema.blockedDomain).where(eq(schema.blockedDomain.domain, BLOCKED_HOST));
    await db.delete(schema.subscription).where(eq(schema.subscription.userId, USER_ID));
    await db.delete(schema.link).where(eq(schema.link.userId, USER_ID));
    await db.delete(schema.token).where(eq(schema.token.userId, USER_ID));
    await db.delete(schema.user).where(eq(schema.user.id, USER_ID));
  });

  test("counts the link and attributes it to the token owner", async () => {
    const response = await createLink();
    expect(response.status).toBe(201);

    const links = await db.select().from(schema.link).where(eq(schema.link.userId, USER_ID));
    expect(links).toHaveLength(1);
    expect(links[0]?.createdByUserId).toBe(USER_ID);
    expect(await storedCount()).toBe(1);
  });

  test("returns the created link with its id and creation time", async () => {
    const response = await createLink({ alias: "route-test-shape" });
    expect(response.status).toBe(201);

    const stored = await db.query.link.findFirst({ where: eq(schema.link.userId, USER_ID) });
    expect(await response.json()).toEqual({
      id: stored?.id,
      shortLink: `https://${stored?.domain}/route-test-shape`,
      url: TARGET_URL,
      alias: "route-test-shape",
      createdAt: stored?.createdAt?.toISOString(),
      expiresAt: null,
      activatesAt: null,
      expiresAfter: null,
      isProtected: false,
    });
  });

  test("returns 403 with the dashboard message once the free limit is reached", async () => {
    await reset(30);

    const response = await createLink();
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: { code: "forbidden", message: monthlyLinkLimitMessage("free", 30), details: [] },
    });
    expect(await storedCount()).toBe(30);
  });

  test("rejects custom aliases that fail validateAlias with 400", async () => {
    const tooShort = await createLink({ alias: "abc" });
    expect(tooShort.status).toBe(400);

    const badChars = await createLink({ alias: "bad alias!" });
    expect(badChars.status).toBe(400);

    expect(await storedCount()).toBe(0);
  });

  test("rejects an alias that differs only in case from an existing one", async () => {
    expect((await createLink({ alias: "RouteTestAlias" })).status).toBe(201);

    const duplicate = await createLink({ alias: "routetestalias" });
    expect(duplicate.status).toBe(409);
    expect((await duplicate.json()).error).toMatchObject({
      code: "conflict",
      message: "Alias already exists",
    });
    expect(await storedCount()).toBe(1);
  });

  test("answers a malformed JSON body with a 400 JSON error", async () => {
    const response = await POST(
      new Request("http://localhost/api/v1/links", {
        method: "POST",
        headers: { "x-api-key": API_KEY, "content-type": "application/json" },
        body: "{not json",
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: "invalid_json", message: "Request body must be valid JSON", details: [] },
    });
  });

  test("reports schema failures as JSON with per-field details", async () => {
    const response = await POST(
      new Request("http://localhost/api/v1/links", {
        method: "POST",
        headers: { "x-api-key": API_KEY, "content-type": "application/json" },
        body: JSON.stringify({ url: "not a url" }),
      }),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("validation_failed");
    expect(body.error.details).toEqual([{ path: "url", message: INVALID_URL_MESSAGE }]);
  });

  test("answers a missing API key with a 401 JSON error", async () => {
    const response = await POST(
      new Request("http://localhost/api/v1/links", { method: "POST", body: "{}" }),
    );
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("unauthorized");
  });

  test("refuses password protection on the free plan", async () => {
    const response = await createLink({ password: "hunter22" });
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("forbidden");
  });

  for (const status of ["on_trial", "past_due"]) {
    test(`allows password protection for a ${status} Pro subscriber`, async () => {
      await subscribe({ status });
      const response = await createLink({ password: "hunter22" });
      expect(response.status).toBe(201);
      expect((await response.json()).isProtected).toBe(true);
    });
  }

  test("allows password protection while a cancelled subscription is still paid up", async () => {
    await subscribe({ status: "cancelled", endsAt: new Date(Date.now() + 86_400_000) });
    expect((await createLink({ password: "hunter22" })).status).toBe(201);
  });

  test("refuses UTM parameters to a lapsed Ultra subscriber", async () => {
    await subscribe({
      status: "expired",
      plan: "ultra",
      variantId: PLAN_VARIANT_IDS.ultra.monthly,
    });
    const response = await createLink({ utmParams: { utm_source: "newsletter" } });
    expect(response.status).toBe(403);
    expect((await response.json()).error.message).toContain("Ultra plan");
  });

  test("refuses creates and edits from a restricted account with 403", async () => {
    expect((await createLink({ alias: "restricted-edit" })).status).toBe(201);
    await db
      .update(schema.user)
      .set({ restrictedAt: new Date() })
      .where(eq(schema.user.id, USER_ID));

    const created = await createLink();
    expect(created.status).toBe(403);
    expect((await created.json()).error.message).toBe(ACCOUNT_RESTRICTED_MESSAGE);

    const edited = await PATCH(
      new NextRequest("http://localhost/api/v1/links/restricted-edit", {
        method: "PATCH",
        headers: { "x-api-key": API_KEY, "content-type": "application/json" },
        body: JSON.stringify({ url: "http://localhost/elsewhere" }),
      }),
      { params: Promise.resolve({ alias: "restricted-edit" }) },
    );
    expect(edited.status).toBe(403);
    expect((await edited.json()).error.message).toBe(ACCOUNT_RESTRICTED_MESSAGE);

    const links = await db.select().from(schema.link).where(eq(schema.link.userId, USER_ID));
    expect(links.map((l) => l.url)).toEqual([TARGET_URL]);
    expect(await storedCount()).toBe(1);
  });
  describe("URL safety on create", () => {
    const PHISHING_URL = "https://route-test-phish.example/signin";

    async function apiToken() {
      const auth = await authenticateToken(API_KEY, "api");
      return auth!.token;
    }

    /** Runs the after-response LLM check inline, with an LLM that calls every page phishing. */
    function flaggingLlm() {
      const pending: Promise<unknown>[] = [];
      const deps: TokenLinkDeps = {
        // Skips the Safe Browsing call; the blocklist and heuristics are covered below.
        checkUrl: (url) =>
          assertUrlSafeFast(url, async () => ({ blocked: false, reason: "", userMessage: "" })),
        checkUrlAfterCreate: (linkId, url) => {
          pending.push(
            checkUrlWithLlm(linkId, url, {
              readVerdict: async () => false,
              scrape: async () => ({ title: "Sign in", description: "", image: "", favicon: "" }),
              detect: async (detected) => ({ url: detected, phishing: true }),
              rememberVerdict: () => {},
            }),
          );
        },
      };
      return { deps, settled: () => Promise.all(pending) };
    }

    async function storedLink() {
      const row = await db.query.link.findFirst({ where: eq(schema.link.userId, USER_ID) });
      const flags = row
        ? await db.select().from(schema.flaggedLink).where(eq(schema.flaggedLink.linkId, row.id))
        : [];
      return { row, flags };
    }

    afterAll(async () => {
      const rows = await db
        .select({ id: schema.link.id })
        .from(schema.link)
        .where(eq(schema.link.userId, USER_ID));
      for (const { id } of rows) {
        await db.delete(schema.flaggedLink).where(eq(schema.flaggedLink.linkId, id));
      }
    });

    test("creates the link before the LLM runs, then blocks it on a free account", async () => {
      const llm = flaggingLlm();
      const created = await createTokenLink(
        await apiToken(),
        { url: PHISHING_URL },
        "api",
        llm.deps,
      );
      expect(created.url).toBe(PHISHING_URL);
      expect((await storedLink()).row?.blocked).toBeFalsy();

      await llm.settled();

      const { row, flags } = await storedLink();
      expect(row?.blocked).toBe(true);
      expect(row?.blockedReason).toBe("phishing-rescan: llm-check");
      expect(flags).toMatchObject([{ status: "blocked", reason: "phishing-rescan: llm-check" }]);
    });

    test("flags the link for review on a paying account instead of blocking it", async () => {
      await subscribe({ status: "active" });
      const llm = flaggingLlm();
      await createTokenLink(await apiToken(), { url: PHISHING_URL }, "api", llm.deps);

      await llm.settled();

      const { row, flags } = await storedLink();
      expect(row?.blocked).toBeFalsy();
      expect(flags).toMatchObject([{ status: "pending", reason: "phishing-rescan: llm-check" }]);
      expect(flags[0]?.details).toContain("paying account");
    });

    test("leaves the link live when the scrape or the LLM fails", async () => {
      const pending: Promise<unknown>[] = [];
      const failing = (scrapeFails: boolean): TokenLinkDeps => ({
        checkUrl: async () => {},
        checkUrlAfterCreate: (linkId, url) => {
          pending.push(
            checkUrlWithLlm(linkId, url, {
              readVerdict: async () => false,
              scrape: async () => {
                if (scrapeFails) throw new Error("fetch failed");
                return { title: "", description: "", image: "", favicon: "" };
              },
              detect: async () => {
                throw new Error("timeout");
              },
              rememberVerdict: () => {},
            }),
          );
        },
      });
      const token = await apiToken();
      await createTokenLink(token, { url: PHISHING_URL }, "api", failing(true));
      await createTokenLink(token, { url: PHISHING_URL }, "api", failing(false));

      expect(await Promise.all(pending)).toEqual(["scrape-failed", "llm-failed"]);
      const rows = await db.select().from(schema.link).where(eq(schema.link.userId, USER_ID));
      expect(rows.map((r) => Boolean(r.blocked))).toEqual([false, false]);
    });

    test("rejects a Safe Browsing hit with 400 before the insert or the LLM", async () => {
      const afterCreate: string[] = [];
      const create = createTokenLink(await apiToken(), { url: PHISHING_URL }, "api", {
        checkUrl: (url) =>
          assertUrlSafeFast(url, async () => ({
            blocked: true,
            reason: "Google Safe Browsing flagged this URL: SOCIAL_ENGINEERING",
            userMessage: USER_MSG_UNSAFE,
          })),
        checkUrlAfterCreate: (_linkId, url) => void afterCreate.push(url),
      });

      expect(create).rejects.toMatchObject({ code: "BAD_REQUEST", message: USER_MSG_UNSAFE });
      await create.catch(() => undefined);
      expect(afterCreate).toEqual([]);
      expect(await storedCount()).toBe(0);
    });

    test("rejects blocklisted and heuristic-flagged URLs with 400 before the insert", async () => {
      await db
        .insert(schema.blockedDomain)
        .values({ domain: BLOCKED_HOST })
        .onDuplicateKeyUpdate({ set: { domain: BLOCKED_HOST } });

      for (const url of [`https://${BLOCKED_HOST}/page`, "http://192.168.10.20/login"]) {
        const response = await POST(
          new Request("http://localhost/api/v1/links", {
            method: "POST",
            headers: { "x-api-key": API_KEY, "content-type": "application/json" },
            body: JSON.stringify({ url }),
          }),
        );
        expect(response.status).toBe(400);
      }
      expect(await storedCount()).toBe(0);
    });
  });
});
