import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import crypto from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import { NextRequest } from "next/server";
import { z } from "zod";

import { env } from "@/env.mjs";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { clearApiSunsetCache } from "@/server/lib/api-access";
import { clearPlanLimitHitMemo } from "@/server/lib/plan-limit-hits";

import { encodeLinkCursor } from "./cursor";
import { GET } from "./route";

// Runs against a disposable MySQL with the schema pushed (test/setup.ts points
// the app's db client at it); see CONTRIBUTING.md, "Database tests".
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

const listBody = z.object({
  data: z.array(z.looseObject({ alias: z.string() })),
  nextCursor: z.string().nullable(),
});

async function readPage(response: Response | Promise<Response>) {
  const resolved = await response;
  expect(resolved.status).toBe(200);
  return listBody.parse(await resolved.json());
}

describe.skipIf(!testDatabaseUrl)("GET /api/v1/links (MySQL)", () => {
  const USER_ID = "api_links_list_test";
  const OTHER_USER_ID = "api_links_list_other";
  const API_KEY = "api-links-list-test-key";
  const ACTIVE_DOMAIN = "links-list-active.example";
  const PENDING_DOMAIN = "links-list-pending.example";
  const users = [USER_ID, OTHER_USER_ID];
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
    await db.delete(schema.planLimitHit).where(inArray(schema.planLimitHit.userId, users));
    await db.delete(schema.customDomain).where(inArray(schema.customDomain.userId, users));
    await db.delete(schema.link).where(inArray(schema.link.userId, users));
    await db.delete(schema.token).where(inArray(schema.token.userId, users));
    await db.delete(schema.user).where(inArray(schema.user.id, users));
  }

  const at = (minute: number) => new Date(Date.UTC(2026, 10, 1, 12, minute));

  beforeEach(async () => {
    await cleanup();
    await db.insert(schema.user).values([
      { id: USER_ID, email: `${USER_ID}@example.com`, planCheckedAt: new Date() },
      { id: OTHER_USER_ID, email: `${OTHER_USER_ID}@example.com`, planCheckedAt: new Date() },
    ]);
    await db.insert(schema.token).values({
      userId: USER_ID,
      token: crypto.createHash("sha256").update(API_KEY).digest("hex"),
    });
    await db.insert(schema.customDomain).values([
      { domain: ACTIVE_DOMAIN, userId: USER_ID, status: "active" },
      { domain: PENDING_DOMAIN, userId: USER_ID, status: "pending" },
    ]);
    // Inserted in this order, so ids ascend down the list. list-b and list-c
    // share a createdAt to exercise the id tie-break.
    await db.insert(schema.link).values(
      [
        { alias: "list-a", domain: "isht.app", createdAt: at(1) },
        { alias: "list-b", domain: "isht.ink", createdAt: at(2) },
        { alias: "list-c", domain: "isht.app", createdAt: at(2) },
        { alias: "list-d", domain: ACTIVE_DOMAIN, createdAt: at(3), blocked: true },
        { alias: "list-e", domain: "isht.app", createdAt: at(4), passwordHash: "hash" },
      ].map((values) => ({ ...values, url: "https://example.com", userId: USER_ID })),
    );
    // Out of the key's reach: another account, a team, a custom domain that isn't active.
    await db.insert(schema.link).values(
      [
        { alias: "list-other", domain: "isht.app", userId: OTHER_USER_ID, createdAt: at(5) },
        {
          alias: "list-team",
          domain: "isht.app",
          userId: USER_ID,
          teamId: 999_999,
          createdAt: at(5),
        },
        { alias: "list-pending", domain: PENDING_DOMAIN, userId: USER_ID, createdAt: at(5) },
      ].map((values) => ({ ...values, url: "https://example.com" })),
    );
  });

  afterAll(cleanup);

  const list = (query = "", apiKey: string | null = API_KEY) =>
    GET(
      new NextRequest(`http://localhost/api/v1/links${query}`, {
        headers: apiKey ? { "x-api-key": apiKey } : {},
      }),
    );

  async function listAll(query: string) {
    const aliases: string[] = [];
    const pages: number[] = [];
    let cursor: string | null = null;
    do {
      const body = await readPage(list(`${query}${cursor ? `&cursor=${cursor}` : ""}`));
      aliases.push(...body.data.map((l) => l.alias));
      pages.push(body.data.length);
      cursor = body.nextCursor;
    } while (cursor);
    return { aliases, pages };
  }

  test("answers a missing or unknown API key with a 401 JSON error", async () => {
    for (const key of [null, "not-a-key"]) {
      const response = await list("", key);
      expect(response.status).toBe(401);
      expect((await response.json()).error.code).toBe("unauthorized");
    }
  });

  test("returns the key owner's personal links newest first, in the single-link shape", async () => {
    const response = await list();
    expect(response.headers.get("X-RateLimit-Limit")).not.toBeNull();
    const body = await readPage(response);
    expect(body.nextCursor).toBeNull();
    expect(body.data.map((l) => l.alias)).toEqual([
      "list-e",
      "list-d",
      "list-c",
      "list-b",
      "list-a",
    ]);
    const stored = await db.query.link.findFirst({ where: eq(schema.link.alias, "list-e") });
    expect(body.data[0]).toEqual({
      id: stored?.id,
      shortLink: "https://isht.app/list-e",
      url: "https://example.com",
      alias: "list-e",
      createdAt: "2026-11-01T12:04:00.000Z",
      expiresAt: null,
      activatesAt: null,
      expiresAfter: null,
    });
  });

  test("pages through every link exactly once with limit=2", async () => {
    const { aliases, pages } = await listAll("?limit=2");
    expect(aliases).toEqual(["list-e", "list-d", "list-c", "list-b", "list-a"]);
    expect(pages).toEqual([2, 2, 1]);
  });

  test("ends with a null cursor when the last page is full", async () => {
    const first = await readPage(list("?limit=3"));
    const second = await readPage(list(`?limit=3&cursor=${first.nextCursor}`));
    expect(second.data.map((l) => l.alias)).toEqual(["list-b", "list-a"]);
    expect(second.nextCursor).toBeNull();

    const exact = await readPage(list("?limit=5"));
    expect(exact.data).toHaveLength(5);
    expect(exact.nextCursor).toBeNull();
  });

  test("keeps later pages stable while new links are created", async () => {
    const first = await readPage(list("?limit=2"));
    await db.insert(schema.link).values({
      alias: "list-new",
      domain: "isht.app",
      url: "https://example.com",
      userId: USER_ID,
      createdAt: at(30),
    });
    const second = await readPage(list(`?limit=2&cursor=${first.nextCursor}`));
    expect(second.data.map((l) => l.alias)).toEqual(["list-c", "list-b"]);
  });

  test("filters by domain", async () => {
    expect((await listAll("?limit=2&domain=isht.app")).aliases).toEqual([
      "list-e",
      "list-c",
      "list-a",
    ]);
    expect((await listAll(`?domain=${ACTIVE_DOMAIN.toUpperCase()}`)).aliases).toEqual(["list-d"]);
  });

  test("refuses a domain the key can't use", async () => {
    for (const domain of [PENDING_DOMAIN, "someone-else.example"]) {
      const response = await list(`?domain=${domain}`);
      expect(response.status).toBe(403);
      expect((await response.json()).error).toEqual({
        code: "forbidden",
        message: "Domain not available for this API key",
        details: [],
      });
    }
  });

  test("answers a bad limit or cursor with a 400 validation error", async () => {
    const cases: [string, string][] = [
      ["?limit=0", "limit"],
      ["?limit=101", "limit"],
      ["?limit=abc", "limit"],
      ["?limit=2.5", "limit"],
      ["?cursor=not-a-cursor", "cursor"],
      [`?cursor=${Buffer.from("12:x").toString("base64url")}`, "cursor"],
    ];
    for (const [query, path] of cases) {
      const response = await list(query);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe("validation_failed");
      expect(body.error.message).toBe("Query parameters are invalid");
      expect(body.error.details.map((d: { path: string }) => d.path)).toEqual([path]);
    }
  });

  test("a cursor past the last link returns an empty page", async () => {
    const cursor = encodeLinkCursor({ createdAt: new Date(0), id: 1 });
    const body = await readPage(list(`?cursor=${cursor}`));
    expect(body).toEqual({ data: [], nextCursor: null });
  });

  test("a Free key before the sunset works and carries the notice", async () => {
    Object.assign(env, { API_FREE_ACCESS_SUNSET_AT: new Date(Date.now() + 3 * DAY).toISOString() });
    const response = await list("?limit=1");
    expect(response.status).toBe(200);
    expect(response.headers.get("Sunset")).not.toBeNull();
    const body = await response.json();
    expect(body.data).toHaveLength(1);
    expect(body.warning).toContain("stops working on");
  });

  test("a Free key after the sunset gets 403", async () => {
    Object.assign(env, { API_FREE_ACCESS_SUNSET_AT: new Date(Date.now() - 1000).toISOString() });
    const response = await list();
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "API access requires Pro",
      upgrade_url: "https://ishortn.ink/pricing",
    });
  });
});
