import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import crypto from "node:crypto";

import { eq } from "drizzle-orm";

import { env } from "@/env.mjs";
import { API_RATE_LIMITS, PLAN_VARIANT_IDS } from "@/lib/billing/plans";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { clearApiSunsetCache } from "@/server/lib/api-access";
import { clearPlanLimitHitMemo } from "@/server/lib/plan-limit-hits";

import { GET } from "./route";

// Runs against a disposable MySQL with the schema pushed (test/setup.ts points
// the app's db client at it); see CONTRIBUTING.md, "Database tests".
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("GET /api/v1/me (MySQL)", () => {
  const USER_ID = "api_me_route_test";
  const API_KEY = "api-me-route-test-key";
  const originalSunset = env.API_FREE_ACCESS_SUNSET_AT;
  const DAY = 24 * 60 * 60 * 1000;

  beforeAll(() => {
    // Another test file replaces @/env.mjs with a partial object for the whole
    // run, dropping DATABASE_URL; the app's db client reads it on first use.
    if (!env.DATABASE_URL) Object.assign(env, { DATABASE_URL: testDatabaseUrl });
  });

  async function cleanup() {
    clearApiSunsetCache();
    clearPlanLimitHitMemo();
    Object.assign(env, { API_FREE_ACCESS_SUNSET_AT: originalSunset });
    await db.delete(schema.planLimitHit).where(eq(schema.planLimitHit.userId, USER_ID));
    await db.delete(schema.siteSettings).where(eq(schema.siteSettings.userId, USER_ID));
    await db.delete(schema.subscription).where(eq(schema.subscription.userId, USER_ID));
    await db.delete(schema.token).where(eq(schema.token.userId, USER_ID));
    await db.delete(schema.user).where(eq(schema.user.id, USER_ID));
  }

  beforeEach(async () => {
    await cleanup();
    await db.insert(schema.user).values({
      id: USER_ID,
      email: "api-me@example.com",
      name: "Ada Lovelace",
      planCheckedAt: new Date(),
    });
    await db.insert(schema.token).values({
      userId: USER_ID,
      token: crypto.createHash("sha256").update(API_KEY).digest("hex"),
    });
  });

  afterAll(cleanup);

  const me = (apiKey: string | null = API_KEY) =>
    GET(
      new Request("http://localhost/api/v1/me", {
        headers: apiKey ? { "x-api-key": apiKey } : {},
      }),
    );

  test("answers a missing or unknown API key with a 401 JSON error", async () => {
    for (const key of [null, "not-a-key"]) {
      const response = await me(key);
      expect(response.status).toBe(401);
      expect((await response.json()).error.code).toBe("unauthorized");
    }
  });

  test("returns the key owner's account with their effective plan", async () => {
    await db.insert(schema.subscription).values({
      userId: USER_ID,
      status: "active",
      plan: "pro",
      variantId: PLAN_VARIANT_IDS.pro.monthly,
    });
    await db.insert(schema.siteSettings).values({ userId: USER_ID, defaultDomain: "isht.ink" });

    const response = await me();
    expect(response.status).toBe(200);
    // The plan comes from the joined subscription, so the limits are Pro's.
    expect(response.headers.get("X-RateLimit-Limit")).toBe(String(API_RATE_LIMITS.pro.perMinute));
    expect(await response.json()).toEqual({
      id: USER_ID,
      email: "api-me@example.com",
      name: "Ada Lovelace",
      plan: "pro",
      defaultDomain: "isht.ink",
    });
  });

  test("answers keys of banned or deleted accounts with 401", async () => {
    for (const values of [{ banned: true }, { deletedAt: new Date() }]) {
      await db.update(schema.user).set(values).where(eq(schema.user.id, USER_ID));
      const response = await me();
      expect(response.status).toBe(401);
      expect(response.headers.get("X-RateLimit-Limit")).toBeNull();
      await db
        .update(schema.user)
        .set({ banned: false, deletedAt: null })
        .where(eq(schema.user.id, USER_ID));
    }
  });

  test("falls back to the platform default domain", async () => {
    const response = await me();
    expect((await response.json()).defaultDomain).toBe("isht.app");
  });

  test("a Free key before the sunset works and carries the notice", async () => {
    Object.assign(env, { API_FREE_ACCESS_SUNSET_AT: new Date(Date.now() + 3 * DAY).toISOString() });
    const response = await me();
    expect(response.status).toBe(200);
    expect(response.headers.get("Sunset")).not.toBeNull();
    expect(await response.json()).toMatchObject({
      id: USER_ID,
      plan: "free",
      warning: expect.stringContaining("stops working on"),
    });
  });

  test("a Free key after the sunset gets 403", async () => {
    Object.assign(env, { API_FREE_ACCESS_SUNSET_AT: new Date(Date.now() - 1000).toISOString() });
    const response = await me();
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "API access requires Pro",
      upgrade_url: "https://ishortn.ink/pricing",
    });
  });
});
