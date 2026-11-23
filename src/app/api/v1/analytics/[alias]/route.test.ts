import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import crypto from "node:crypto";

import { subDays } from "date-fns";
import { inArray } from "drizzle-orm";
import { NextRequest } from "next/server";

import { env } from "@/env.mjs";
import { API_RATE_LIMITS, PLAN_VARIANT_IDS } from "@/lib/billing/plans";
import { DEFAULT_PLATFORM_DOMAIN } from "@/lib/constants/domains";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";

import { GET } from "./route";

// Runs against a disposable MySQL with the schema pushed (test/setup.ts points
// the app's db client at it); see CONTRIBUTING.md, "Database tests".
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("GET /api/v1/analytics/[alias] (MySQL)", () => {
  const FREE_USER = "api_analytics_free_test";
  const PRO_USER = "api_analytics_pro_test";
  // (alias, domain) is unique, so each account gets its own alias.
  const aliasFor = (userId: string) =>
    userId === FREE_USER ? "api-analytics-free" : "api-analytics-pro";
  const keyFor = (userId: string) => `${userId}-key`;

  beforeAll(() => {
    // Another test file replaces @/env.mjs with a partial object for the whole
    // run, dropping DATABASE_URL; the app's db client reads it on first use.
    if (!env.DATABASE_URL) Object.assign(env, { DATABASE_URL: testDatabaseUrl });
  });

  async function cleanup() {
    const links = await db
      .select({ id: schema.link.id })
      .from(schema.link)
      .where(inArray(schema.link.userId, [FREE_USER, PRO_USER]));
    const linkIds = links.map((row) => row.id);
    if (linkIds.length) {
      await db.delete(schema.linkVisit).where(inArray(schema.linkVisit.linkId, linkIds));
      await db
        .delete(schema.uniqueLinkVisit)
        .where(inArray(schema.uniqueLinkVisit.linkId, linkIds));
      await db
        .delete(schema.linkVisitDailySummary)
        .where(inArray(schema.linkVisitDailySummary.linkId, linkIds));
    }
    await db.delete(schema.link).where(inArray(schema.link.userId, [FREE_USER, PRO_USER]));
    await db.delete(schema.token).where(inArray(schema.token.userId, [FREE_USER, PRO_USER]));
    await db
      .delete(schema.subscription)
      .where(inArray(schema.subscription.userId, [FREE_USER, PRO_USER]));
    await db.delete(schema.user).where(inArray(schema.user.id, [FREE_USER, PRO_USER]));
  }

  // One visit 2 days ago, one 20 days ago, and an archived day 60 days ago.
  async function seedUser(userId: string) {
    const now = new Date();
    await db.insert(schema.user).values({ id: userId, email: `${userId}@example.com` });
    await db.insert(schema.token).values({
      userId,
      token: crypto.createHash("sha256").update(keyFor(userId)).digest("hex"),
    });
    const inserted = await db.insert(schema.link).values({
      url: "https://example.com",
      alias: aliasFor(userId),
      domain: DEFAULT_PLATFORM_DOMAIN,
      userId,
    });
    const linkId = inserted[0].insertId;
    const visitor = {
      device: "Desktop",
      browser: "Chrome",
      os: "macOS",
      country: "Ghana",
      city: "Accra",
    };
    await db.insert(schema.linkVisit).values([
      { ...visitor, linkId, referer: "twitter", createdAt: subDays(now, 2) },
      { ...visitor, linkId, referer: "null", createdAt: subDays(now, 20) },
    ]);
    await db.insert(schema.uniqueLinkVisit).values([
      { linkId, ipHash: "a".repeat(64), createdAt: subDays(now, 2) },
      { linkId, ipHash: "b".repeat(64), createdAt: subDays(now, 20) },
    ]);
    await db.insert(schema.linkVisitDailySummary).values({
      linkId,
      date: subDays(now, 60).toISOString().slice(0, 10),
      clicks: 5,
      uniqueClicks: 3,
    });
  }

  function getAnalytics(userId: string) {
    const alias = aliasFor(userId);
    return GET(
      new NextRequest(
        `http://localhost/api/v1/analytics/${alias}?domain=${DEFAULT_PLATFORM_DOMAIN}`,
        { headers: { "x-api-key": keyFor(userId) } },
      ),
      { params: Promise.resolve({ alias }) },
    );
  }

  beforeEach(async () => {
    await cleanup();
    await seedUser(FREE_USER);
    await seedUser(PRO_USER);
    await db.insert(schema.subscription).values({
      userId: PRO_USER,
      status: "active",
      plan: "pro",
      variantId: PLAN_VARIANT_IDS.pro.monthly,
    });
  }, 30_000);

  afterAll(cleanup);

  test("a Free key only sees the plan's 7-day window", async () => {
    const response = await getAnalytics(FREE_USER);
    expect(response.status).toBe(200);
    expect(response.headers.get("X-RateLimit-Limit")).toBe(String(API_RATE_LIMITS.free.perMinute));

    const body = await response.json();
    expect(body.totalClicks).toBe(1);
    expect(Object.values(body.uniqueClicksPerDate)).toEqual([1]);
    expect(body.window.days).toBe(7);
    const windowMs = Date.parse(body.window.to) - Date.parse(body.window.from);
    expect(windowMs).toBe(7 * 24 * 60 * 60 * 1000);
  });

  test("a Pro key sees all-time analytics, including archived days", async () => {
    const response = await getAnalytics(PRO_USER);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.totalClicks).toBe(7);
    expect(body.clicksPerReferrer).toEqual({ X: 1, Direct: 1 });
    expect(body.window).toMatchObject({ days: null, from: null });
  });

  test("returns 429 with rate limit headers once the minute limit is used up", async () => {
    // Without KV (as here) the limiter still counts within the isolate. A few
    // spare attempts cover a minute boundary passing mid-loop.
    const limit = API_RATE_LIMITS.free.perMinute;
    let last: Response | undefined;
    for (let i = 0; i < limit + 5; i++) {
      last = await getAnalytics(FREE_USER);
      if (last.status === 429) break;
    }

    expect(last?.status).toBe(429);
    expect(Number(last?.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(last?.headers.get("X-RateLimit-Limit")).toBe(String(limit));
    expect(last?.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(Number(last?.headers.get("X-RateLimit-Reset"))).toBeGreaterThan(Date.now() / 1000);

    // Limits are per account: another account is unaffected.
    expect((await getAnalytics(PRO_USER)).status).toBe(200);
  }, 120_000);
});
