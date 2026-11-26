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
import { monthlyLinkLimitMessage } from "@/server/lib/user-plan";

import { PATCH } from "./[alias]/route";
import { POST } from "./route";

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

  async function reset(
    monthlyLinkCount: number,
    restrictedAt: Date | null = null,
    lastLinkCountReset = new Date(),
  ) {
    await db.delete(schema.siteSettings).where(eq(schema.siteSettings.userId, USER_ID));
    await db.delete(schema.subscription).where(eq(schema.subscription.userId, USER_ID));
    await db.delete(schema.link).where(eq(schema.link.userId, USER_ID));
    await db.delete(schema.token).where(eq(schema.token.userId, USER_ID));
    await db.delete(schema.user).where(eq(schema.user.id, USER_ID));
    await db.insert(schema.user).values({
      id: USER_ID,
      monthlyLinkCount,
      lastLinkCountReset,
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

  function timingNames(response: Response) {
    return response.headers
      .get("server-timing")
      ?.split(", ")
      .map((metric) => metric.split(";")[0]);
  }

  beforeEach(() => reset(0));

  afterAll(async () => {
    await db.delete(schema.siteSettings).where(eq(schema.siteSettings.userId, USER_ID));
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

  test("the first create of a new month resets the count to 1", async () => {
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    await reset(30, null, lastMonth);

    expect((await createLink()).status).toBe(201);
    expect(await storedCount()).toBe(1);
  });

  test("concurrent creates one below the limit allow exactly one", async () => {
    await reset(29);

    const responses = await Promise.all(Array.from({ length: 5 }, () => createLink()));

    expect(responses.map((r) => r.status).sort()).toEqual([201, 403, 403, 403, 403]);
    expect(await storedCount()).toBe(30);
  });

  test("creates on the account's default domain when none is given", async () => {
    await db.insert(schema.siteSettings).values({ userId: USER_ID, defaultDomain: "isht.ink" });

    const response = await createLink({ alias: "route-test-default" });
    expect(response.status).toBe(201);
    expect((await response.json()).shortLink).toBe("https://isht.ink/route-test-default");
  });

  test("returns a protected link's stored values", async () => {
    await subscribe({ status: "active" });
    const response = await createLink({ alias: "route-test-protected", password: "hunter22" });
    expect(response.status).toBe(201);

    const stored = await db.query.link.findFirst({ where: eq(schema.link.userId, USER_ID) });
    expect(await response.json()).toEqual({
      id: stored?.id,
      shortLink: `https://${stored?.domain}/route-test-protected`,
      url: TARGET_URL,
      alias: "route-test-protected",
      createdAt: stored?.createdAt?.toISOString(),
      expiresAt: null,
      activatesAt: null,
      expiresAfter: null,
      isProtected: true,
    });
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

  test("reports the create steps in Server-Timing", async () => {
    const response = await createLink();
    expect(response.status).toBe(201);
    expect(timingNames(response)).toEqual(
      expect.arrayContaining(["auth", "domain", "alias", "safety", "db", "total"]),
    );
    // The response is built from the inserted values, so there is no read-back step.
    expect(timingNames(response)).not.toContain("read");
    // The page fetch and LLM check run after the response.
    expect(timingNames(response)).not.toContain("scrape");
    expect(timingNames(response)).not.toContain("llm");
    expect(response.headers.get("server-timing")).not.toContain("localhost");
  });

  test("reports Server-Timing on a plan-limit refusal", async () => {
    await reset(30);
    const response = await createLink({ alias: "route-test-limit" });
    expect(response.status).toBe(403);
    const names = timingNames(response);
    expect(names).toEqual(expect.arrayContaining(["auth", "domain", "alias", "safety", "db"]));
    expect(names).not.toContain("read");
  });

  test("reports Server-Timing when the safety check blocks the URL", async () => {
    const response = await POST(
      new Request("http://localhost/api/v1/links", {
        method: "POST",
        headers: { "x-api-key": API_KEY, "content-type": "application/json" },
        body: JSON.stringify({ url: "http://192.0.2.10/login" }),
      }),
    );
    expect(response.status).toBe(400);
    const header = response.headers.get("server-timing");
    expect(header).toContain("safety;dur=");
    expect(header).toContain('desc="blocked-pre-llm"');
    expect(timingNames(response)).not.toContain("db");
  });

  test("reports auth and total in Server-Timing for a missing API key", async () => {
    const response = await POST(
      new Request("http://localhost/api/v1/links", { method: "POST", body: "{}" }),
    );
    expect(response.status).toBe(401);
    expect(timingNames(response)).toEqual(["auth", "total"]);
  });
});
