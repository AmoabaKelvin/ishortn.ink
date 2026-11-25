import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import crypto from "node:crypto";

import { eq } from "drizzle-orm";

import { env } from "@/env.mjs";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { clearApiSunsetCache } from "@/server/lib/api-access";
import { clearPlanLimitHitMemo } from "@/server/lib/plan-limit-hits";

import { apiAccessRevokedResponse, apiSunsetHeaders, withApiSunsetNotice } from "./api-access";
import { POST } from "./links/route";

import type { ApiAccess } from "@/lib/billing/api-access";

const DAY = 24 * 60 * 60 * 1000;
const SUNSET = new Date("2026-11-27T12:00:00Z");
const sunsetting: Extract<ApiAccess, { status: "sunsetting" }> = {
  status: "sunsetting",
  deprecatedAt: new Date(SUNSET.getTime() - 7 * DAY),
  sunsetAt: SUNSET,
};

describe("apiSunsetHeaders", () => {
  test("Deprecation is a structured date, Sunset an HTTP date", () => {
    expect(apiSunsetHeaders(sunsetting)).toEqual({
      Deprecation: `@${(SUNSET.getTime() - 7 * DAY) / 1000}`,
      Sunset: "Fri, 27 Nov 2026 12:00:00 GMT",
      Link: '<https://ishortn.ink/pricing>; rel="sunset"',
    });
  });
});

describe("withApiSunsetNotice", () => {
  test("adds the headers and a warning field to JSON object bodies", async () => {
    const original = Response.json({ alias: "abc" }, { status: 201 });
    original.headers.set("X-RateLimit-Limit", "60");

    const response = await withApiSunsetNotice(original, sunsetting);

    expect(response.status).toBe(201);
    expect(response.headers.get("Sunset")).toBe("Fri, 27 Nov 2026 12:00:00 GMT");
    expect(response.headers.get("Deprecation")).toStartWith("@");
    expect(response.headers.get("X-RateLimit-Limit")).toBe("60");
    expect(await response.json()).toEqual({
      alias: "abc",
      warning: expect.stringContaining("November 27, 2026"),
    });
  });

  test("keeps plain-text bodies and only adds the headers", async () => {
    const response = await withApiSunsetNotice(
      new Response("Link not found", { status: 404 }),
      sunsetting,
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("Sunset")).toBe("Fri, 27 Nov 2026 12:00:00 GMT");
    expect(await response.text()).toBe("Link not found");
  });

  test("leaves responses for keys with full access untouched", async () => {
    const original = Response.json({ alias: "abc" });
    const response = await withApiSunsetNotice(original, { status: "full" });

    expect(response).toBe(original);
    expect(response.headers.get("Sunset")).toBeNull();
  });
});

describe("apiAccessRevokedResponse", () => {
  test("is a 403 with the upgrade URL", async () => {
    const response = apiAccessRevokedResponse();
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "API access requires Pro",
      upgrade_url: "https://ishortn.ink/pricing",
    });
  });
});

// Runs against a disposable MySQL with the schema pushed; see CONTRIBUTING.md,
// "Database tests".
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("API key access by plan (MySQL)", () => {
  const USER_ID = "api_access_test";
  const API_KEY = "api-access-test-key";
  const originalSunset = env.API_FREE_ACCESS_SUNSET_AT;

  beforeAll(() => {
    if (!env.DATABASE_URL) Object.assign(env, { DATABASE_URL: testDatabaseUrl });
  });

  async function cleanup() {
    await db.delete(schema.apiAccessSunset);
    clearApiSunsetCache();
    clearPlanLimitHitMemo();
    await db.delete(schema.planLimitHit).where(eq(schema.planLimitHit.userId, USER_ID));
    await db.delete(schema.link).where(eq(schema.link.userId, USER_ID));
    await db.delete(schema.token).where(eq(schema.token.userId, USER_ID));
    await db.delete(schema.subscription).where(eq(schema.subscription.userId, USER_ID));
    await db.delete(schema.user).where(eq(schema.user.id, USER_ID));
  }

  beforeEach(async () => {
    await cleanup();
    await db.insert(schema.user).values({
      id: USER_ID,
      email: `${USER_ID}@example.com`,
      lastLinkCountReset: new Date(),
    });
    await db.insert(schema.token).values({
      userId: USER_ID,
      token: crypto.createHash("sha256").update(API_KEY).digest("hex"),
    });
  });

  afterAll(async () => {
    Object.assign(env, { API_FREE_ACCESS_SUNSET_AT: originalSunset });
    await cleanup();
  });

  function setSunset(date: Date | undefined) {
    Object.assign(env, { API_FREE_ACCESS_SUNSET_AT: date?.toISOString() });
  }

  function createLink() {
    return POST(
      new Request("http://localhost/api/v1/links", {
        method: "POST",
        headers: { "x-api-key": API_KEY, "content-type": "application/json" },
        body: JSON.stringify({ url: "http://localhost/api-access-test" }),
      }),
    );
  }

  test("a Free key works without the notice until the cutoff is stored", async () => {
    setSunset(undefined);
    const response = await createLink();

    expect(response.status).toBe(201);
    expect(response.headers.get("Sunset")).toBeNull();
    expect(response.headers.get("Deprecation")).toBeNull();
    expect(await response.json()).not.toHaveProperty("warning");
  });

  test("a Free key gets 403 once the stored cutoff has passed", async () => {
    setSunset(undefined);
    await db.insert(schema.apiAccessSunset).values({ id: 1, sunsetAt: new Date(Date.now() - DAY) });
    const response = await createLink();

    expect(response.status).toBe(403);
  });

  test("an expired subscription keeps working for 7 days after it ends", async () => {
    setSunset(new Date(Date.now() - 2 * DAY));
    // What the webhook writes on subscription_expired.
    await db.insert(schema.subscription).values({
      userId: USER_ID,
      subscriptionId: 42,
      status: "expired",
      plan: "free",
      variantId: 0,
      productId: 0,
      endsAt: new Date(Date.now() - DAY),
    });
    const response = await createLink();

    expect(response.status).toBe(201);
    expect(response.headers.get("Sunset")).not.toBeNull();
  });

  test("an expired subscription gets 403 7 days after it ends", async () => {
    setSunset(new Date(Date.now() - 10 * DAY));
    await db.insert(schema.subscription).values({
      userId: USER_ID,
      subscriptionId: 42,
      status: "expired",
      plan: "free",
      variantId: 0,
      productId: 0,
      endsAt: new Date(Date.now() - 8 * DAY),
    });
    const response = await createLink();

    expect(response.status).toBe(403);
  });

  test("a Free key before the sunset works and carries the notice", async () => {
    setSunset(new Date(Date.now() + 3 * DAY));
    const response = await createLink();

    expect(response.status).toBe(201);
    expect(response.headers.get("Sunset")).not.toBeNull();
    expect(response.headers.get("Deprecation")).not.toBeNull();
    expect(response.headers.get("X-RateLimit-Limit")).toBe("60");
    expect(await response.json()).toMatchObject({
      warning: expect.stringContaining("stops working on"),
    });
  });

  test("a Free key after the sunset gets 403", async () => {
    setSunset(new Date(Date.now() - 1000));
    const response = await createLink();

    expect(response.status).toBe(403);
    const hits = await db
      .select()
      .from(schema.planLimitHit)
      .where(eq(schema.planLimitHit.userId, USER_ID));
    expect(hits.map((hit) => [hit.limitKey, hit.plan])).toEqual([["api_v1", "free"]]);
    expect(await response.json()).toEqual({
      error: "API access requires Pro",
      upgrade_url: "https://ishortn.ink/pricing",
    });
  });

  test("a Pro key after the sunset works without the notice", async () => {
    setSunset(new Date(Date.now() - 1000));
    await db.insert(schema.subscription).values({
      userId: USER_ID,
      status: "active",
      plan: "pro",
      variantId: 1811616,
    });
    const response = await createLink();

    expect(response.status).toBe(201);
    expect(response.headers.get("Sunset")).toBeNull();
  });

  test("a lapsed key within 7 days of the lapse still works after the sunset", async () => {
    setSunset(new Date(Date.now() - 1000));
    await db.insert(schema.subscription).values({
      userId: USER_ID,
      status: "cancelled",
      plan: "pro",
      variantId: 1811616,
      endsAt: new Date(Date.now() - DAY),
    });
    const response = await createLink();

    expect(response.status).toBe(201);
    expect(response.headers.get("Sunset")).not.toBeNull();
  });
});
