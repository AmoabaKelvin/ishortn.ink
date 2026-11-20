import { afterAll, beforeAll, beforeEach, describe, expect, setSystemTime, test } from "bun:test";
import crypto from "node:crypto";

import { eq } from "drizzle-orm";

import { env } from "@/env.mjs";
import { API_FREE_ACCESS_SUNSET_AT } from "@/lib/billing/api-access";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";

import {
  apiAccessRevokedResponse,
  apiSunsetHeaders,
  withApiAccess,
  withApiSunsetNotice,
} from "./api-access";
import { POST } from "./links/route";

import type { ApiAccess } from "@/lib/billing/api-access";
import type { Subscription } from "@/server/db/schema";

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

describe("withApiAccess", () => {
  const before = { sunsetAt: SUNSET, now: new Date(SUNSET.getTime() - 3 * DAY) };
  const after = { sunsetAt: SUNSET, now: new Date(SUNSET.getTime() + 1000) };
  const proSubscription: Subscription = {
    id: 1,
    userId: "user_1",
    orderId: 10,
    subscriptionId: 100,
    customerId: 1000,
    renewsAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    endsAt: null,
    status: "active",
    plan: "pro",
    billingInterval: "monthly",
    variantId: 1811616,
    productId: 0,
    providerUpdatedAt: null,
    cardBrand: "visa",
    cardLastFour: "4242",
  };

  function handler() {
    let calls = 0;
    return {
      handle: async () => {
        calls++;
        return Response.json({ alias: "abc" }, { status: 201 });
      },
      calls: () => calls,
    };
  }

  test("a Free key before the sunset runs the handler and carries the notice", async () => {
    const { handle, calls } = handler();
    const response = await withApiAccess(null, handle, before);

    expect(calls()).toBe(1);
    expect(response.status).toBe(201);
    expect(response.headers.get("Sunset")).toBe("Fri, 27 Nov 2026 12:00:00 GMT");
    expect(response.headers.get("Deprecation")).toStartWith("@");
    expect(await response.json()).toMatchObject({
      warning: expect.stringContaining("stops working on November 27, 2026"),
    });
  });

  test("a Free key from the sunset on gets 403 without running the handler", async () => {
    const { handle, calls } = handler();
    const response = await withApiAccess(null, handle, after);

    expect(calls()).toBe(0);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "API access requires Pro",
      upgrade_url: "https://ishortn.ink/pricing",
    });
  });

  test("a Pro key after the sunset runs without the notice", async () => {
    const response = await withApiAccess(proSubscription, handler().handle, after);

    expect(response.status).toBe(201);
    expect(response.headers.get("Sunset")).toBeNull();
    expect(await response.json()).toEqual({ alias: "abc" });
  });

  test("a lapsed key keeps working for 7 days after the lapse, then gets 403", async () => {
    const lapsed = { ...proSubscription, status: "cancelled", endsAt: after.now };

    const inWindow = await withApiAccess(lapsed, handler().handle, {
      sunsetAt: SUNSET,
      now: new Date(after.now.getTime() + 6 * DAY),
    });
    expect(inWindow.status).toBe(201);
    expect(inWindow.headers.get("Sunset")).toBe(
      new Date(after.now.getTime() + 7 * DAY).toUTCString(),
    );

    const pastWindow = await withApiAccess(lapsed, handler().handle, {
      sunsetAt: SUNSET,
      now: new Date(after.now.getTime() + 7 * DAY),
    });
    expect(pastWindow.status).toBe(403);
  });
});

// Runs against a disposable MySQL with the schema pushed; see CONTRIBUTING.md,
// "Database tests".
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("API key access by plan (MySQL)", () => {
  const USER_ID = "api_access_test";
  const API_KEY = "api-access-test-key";

  beforeAll(() => {
    if (!env.DATABASE_URL) Object.assign(env, { DATABASE_URL: testDatabaseUrl });
  });

  async function cleanup() {
    await db.delete(schema.link).where(eq(schema.link.userId, USER_ID));
    await db.delete(schema.token).where(eq(schema.token.userId, USER_ID));
    await db.delete(schema.subscription).where(eq(schema.subscription.userId, USER_ID));
    await db.delete(schema.user).where(eq(schema.user.id, USER_ID));
  }

  beforeEach(async () => {
    await cleanup();
    await db.insert(schema.user).values({ id: USER_ID, lastLinkCountReset: new Date() });
    await db.insert(schema.token).values({
      userId: USER_ID,
      token: crypto.createHash("sha256").update(API_KEY).digest("hex"),
    });
  });

  afterAll(async () => {
    setSystemTime();
    await cleanup();
  });

  // Moves the clock relative to the committed cutoff.
  function setClock(offsetFromSunset: number) {
    setSystemTime(new Date(API_FREE_ACCESS_SUNSET_AT.getTime() + offsetFromSunset));
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

  test("a Free key before the sunset works and carries the notice", async () => {
    setClock(-3 * DAY);
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
    setClock(1000);
    const response = await createLink();

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "API access requires Pro",
      upgrade_url: "https://ishortn.ink/pricing",
    });
  });

  test("a Pro key after the sunset works without the notice", async () => {
    setClock(1000);
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
    setClock(1000);
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
