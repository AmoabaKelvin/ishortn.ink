import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import crypto from "node:crypto";

import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

import { env } from "@/env.mjs";
import { ACCOUNT_RESTRICTED_MESSAGE } from "@/lib/constants/moderation";
import { EXTENSION_UPGRADE_URL } from "@/lib/extension/connect";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { monthlyLinkLimitMessage } from "@/server/lib/user-plan";

import { GET as v1ListLinks, POST as v1CreateLink } from "../v1/links/route";
import { GET as listLinks, OPTIONS as linksPreflight, POST as createLink } from "./links/route";
import { GET as getMe, OPTIONS as mePreflight } from "./me/route";
import { DELETE as signOut, OPTIONS as sessionPreflight } from "./session/route";

// Runs against a disposable MySQL with the schema pushed; see CONTRIBUTING.md, "Database tests".
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("/api/extension (MySQL)", () => {
  const USER_ID = "extension_routes_test";
  const EXTENSION_TOKEN = "extension-routes-test-token";
  const API_KEY = "extension-routes-test-api-key";
  // localhost is refused by the metadata scraper, so the URL safety check fails open offline.
  const TARGET_URL = "http://localhost/extension-test";

  beforeAll(() => {
    if (!env.DATABASE_URL) Object.assign(env, { DATABASE_URL: testDatabaseUrl });
  });

  const hash = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

  async function cleanup() {
    await db.delete(schema.link).where(eq(schema.link.userId, USER_ID));
    await db.delete(schema.token).where(eq(schema.token.userId, USER_ID));
    await db.delete(schema.subscription).where(eq(schema.subscription.userId, USER_ID));
    await db.delete(schema.user).where(eq(schema.user.id, USER_ID));
  }

  async function reset(values: Partial<typeof schema.user.$inferInsert> = {}) {
    await cleanup();
    await db.insert(schema.user).values({
      id: USER_ID,
      email: "extension@example.com",
      monthlyLinkCount: 0,
      lastLinkCountReset: new Date(),
      planCheckedAt: new Date(),
      ...values,
    });
    await db.insert(schema.token).values([
      {
        userId: USER_ID,
        token: hash(EXTENSION_TOKEN),
        kind: "extension",
        label: "Chrome on macOS",
      },
      { userId: USER_ID, token: hash(API_KEY), kind: "api" },
    ]);
  }

  function extensionRequest(path: string, init: RequestInit = {}, bearer = EXTENSION_TOKEN) {
    return new NextRequest(`http://localhost/api/extension${path}`, {
      ...init,
      headers: { authorization: `Bearer ${bearer}`, "content-type": "application/json" },
    });
  }

  function shorten(body: { url?: string; alias?: string } = {}, bearer = EXTENSION_TOKEN) {
    return createLink(
      extensionRequest(
        "/links",
        { method: "POST", body: JSON.stringify({ url: TARGET_URL, ...body }) },
        bearer,
      ),
    );
  }

  beforeEach(() => reset());
  afterAll(cleanup);

  test("creates a link on the free plan and counts it", async () => {
    const response = await shorten({ alias: "ext-route-test" });
    expect(response.status).toBe(201);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    const body = await response.json();
    expect(body).toMatchObject({ alias: "ext-route-test", url: TARGET_URL });
    expect(body.shortUrl).toBe(`https://${body.domain}/ext-route-test`);

    const user = await db.query.user.findFirst({ where: eq(schema.user.id, USER_ID) });
    expect(user?.monthlyLinkCount).toBe(1);
  });

  test("answers the free monthly limit with 403 and the upgrade URL", async () => {
    await reset({ monthlyLinkCount: 29 });
    expect((await shorten()).status).toBe(201);

    const response = await shorten();
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: monthlyLinkLimitMessage("free", 30),
      upgradeUrl: EXTENSION_UPGRADE_URL,
    });
  });

  test("refuses API keys", async () => {
    const response = await shorten({}, API_KEY);
    expect(response.status).toBe(401);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect((await getMe(extensionRequest("/me", {}, API_KEY))).status).toBe(401);
  });

  test("extension tokens are refused by /api/v1", async () => {
    const created = await v1CreateLink(
      new Request("http://localhost/api/v1/links", {
        method: "POST",
        headers: { "x-api-key": EXTENSION_TOKEN, "content-type": "application/json" },
        body: JSON.stringify({ url: TARGET_URL }),
      }),
    );
    expect(created.status).toBe(401);
    const listed = await v1ListLinks(
      new NextRequest("http://localhost/api/v1/links", {
        headers: { "x-api-key": EXTENSION_TOKEN },
      }),
    );
    expect(listed.status).toBe(401);
  });

  test("ignores cookies and requests without a bearer token", async () => {
    const response = await createLink(
      new Request("http://localhost/api/extension/links", {
        method: "POST",
        headers: { cookie: "__session=abc", "content-type": "application/json" },
        body: JSON.stringify({ url: TARGET_URL }),
      }),
    );
    expect(response.status).toBe(401);
  });

  test("refuses banned and deleted accounts with 401", async () => {
    await reset({ banned: true });
    expect((await shorten()).status).toBe(401);
    await reset({ deletedAt: new Date() });
    expect((await getMe(extensionRequest("/me"))).status).toBe(401);
  });

  test("refuses link creation from a restricted account with 403", async () => {
    await reset({ restrictedAt: new Date() });
    const response = await shorten();
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: ACCOUNT_RESTRICTED_MESSAGE });
  });

  test("passes the server's message on for an invalid destination", async () => {
    const response = await shorten({ url: "not a url" });
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBeString();
  });

  test("returns the account, usage and domains from /me", async () => {
    await reset({ monthlyLinkCount: 12 });
    const response = await getMe(extensionRequest("/me"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      email: "extension@example.com",
      plan: "free",
      linksUsedThisMonth: 12,
      linksLimit: 30,
      upgradeUrl: EXTENSION_UPGRADE_URL,
    });
    expect(body.domains.filter((d: { isDefault: boolean }) => d.isDefault)).toHaveLength(1);
  });

  test("lists the newest links", async () => {
    await shorten({ alias: "ext-recent-one" });
    await shorten({ alias: "ext-recent-two" });
    const response = await listLinks(extensionRequest("/links?limit=1"));
    expect(response.status).toBe(200);
    const { links } = await response.json();
    expect(links).toHaveLength(1);
    expect(links[0].url).toBe(TARGET_URL);
  });

  test("sign out deletes the calling token only", async () => {
    const response = await signOut(extensionRequest("/session", { method: "DELETE" }));
    expect(response.status).toBe(204);
    const tokens = await db.select().from(schema.token).where(eq(schema.token.userId, USER_ID));
    expect(tokens.map((t) => t.kind)).toEqual(["api"]);
    expect((await getMe(extensionRequest("/me"))).status).toBe(401);
  });
});

describe("CORS preflight", () => {
  for (const [path, preflight] of [
    ["/links", linksPreflight],
    ["/me", mePreflight],
    ["/session", sessionPreflight],
  ] as const) {
    test(`${path} answers OPTIONS with 204 and the CORS headers`, () => {
      const response = preflight();
      expect(response.status).toBe(204);
      expect(response.headers.get("access-control-allow-origin")).toBe("*");
      expect(response.headers.get("access-control-allow-headers")).toBe(
        "Authorization, Content-Type",
      );
      expect(response.headers.get("access-control-allow-methods")).toBe(
        "GET, POST, DELETE, OPTIONS",
      );
    });
  }
});
