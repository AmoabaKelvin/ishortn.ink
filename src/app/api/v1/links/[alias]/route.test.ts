import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import crypto from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import { NextRequest } from "next/server";

import { env } from "@/env.mjs";
import { DEFAULT_PLATFORM_DOMAIN, PLATFORM_DOMAINS } from "@/lib/constants/domains";
import { resolveLink } from "@/middlewares/record-click";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";

import { DELETE, GET, PATCH } from "./route";

// Runs against a disposable MySQL with the schema pushed (test/setup.ts points
// the app's db client at it); see CONTRIBUTING.md, "Database tests".
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("PATCH and DELETE /api/v1/links/[alias] (MySQL)", () => {
  const USER_ID = "api_link_alias_route_test";
  const OTHER_USER_ID = "api_link_alias_route_other";
  const API_KEY = "api-link-alias-route-test-key";
  const ALIAS = "alias-route-test";
  const OTHER_ALIAS = "alias-route-other";
  const CREATED_AT = new Date(Date.UTC(2026, 10, 1, 12, 30));

  // OpenNext reads the request context from this global; resolveLink fills the
  // link cache through waitUntil. Without a KV binding the cache is a no-op.
  const CLOUDFLARE_CONTEXT = Symbol.for("__cloudflare-context__");

  beforeAll(() => {
    Reflect.set(globalThis, CLOUDFLARE_CONTEXT, { env: {}, cf: {}, ctx: { waitUntil: () => {} } });
    // Another test file replaces @/env.mjs with a partial object for the whole
    // run, dropping DATABASE_URL; the app's db client reads it on first use.
    if (!env.DATABASE_URL) Object.assign(env, { DATABASE_URL: testDatabaseUrl });
  });

  const users = [USER_ID, OTHER_USER_ID];

  async function cleanup() {
    await db
      .delete(schema.linkPreviousAddress)
      .where(inArray(schema.linkPreviousAddress.alias, [ALIAS, OTHER_ALIAS]));
    await db.delete(schema.link).where(inArray(schema.link.userId, users));
    await db.delete(schema.token).where(inArray(schema.token.userId, users));
    await db.delete(schema.user).where(inArray(schema.user.id, users));
  }

  beforeEach(async () => {
    await cleanup();
    await db.insert(schema.user).values([
      { id: USER_ID, email: `${USER_ID}@example.com` },
      { id: OTHER_USER_ID, email: `${OTHER_USER_ID}@example.com` },
    ]);
    await db.insert(schema.token).values({
      userId: USER_ID,
      token: crypto.createHash("sha256").update(API_KEY).digest("hex"),
    });
    await db.insert(schema.link).values([
      {
        url: "https://example.com",
        alias: ALIAS,
        domain: DEFAULT_PLATFORM_DOMAIN,
        userId: USER_ID,
        createdAt: CREATED_AT,
      },
      {
        url: "https://example.com",
        alias: OTHER_ALIAS,
        domain: DEFAULT_PLATFORM_DOMAIN,
        userId: OTHER_USER_ID,
      },
    ]);
  });

  afterAll(async () => {
    await cleanup();
    Reflect.deleteProperty(globalThis, CLOUDFLARE_CONTEXT);
  });

  const request = (alias: string, init: { method: string; body?: string }) =>
    [
      new NextRequest(`http://localhost/api/v1/links/${alias}`, {
        ...init,
        headers: { "x-api-key": API_KEY, "content-type": "application/json" },
      }),
      { params: Promise.resolve({ alias }) },
    ] as const;

  const patch = (alias: string, body: string) =>
    PATCH(...request(alias, { method: "PATCH", body }));
  const get = (alias: string) => GET(...request(alias, { method: "GET" }));
  const remove = (alias: string) => DELETE(...request(alias, { method: "DELETE" }));

  const findLink = (alias: string) =>
    db.query.link.findFirst({ where: eq(schema.link.alias, alias) });

  test("GET returns the link with its id and creation time", async () => {
    const response = await get(ALIAS);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: (await findLink(ALIAS))?.id,
      shortLink: `https://${DEFAULT_PLATFORM_DOMAIN}/${ALIAS}`,
      url: "https://example.com",
      alias: ALIAS,
      createdAt: CREATED_AT.toISOString(),
      expiresAt: null,
      activatesAt: null,
      expiresAfter: null,
    });
  });

  test("GET does not reach another account's link", async () => {
    const response = await get(OTHER_ALIAS);
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("not_found");
  });

  test("PATCH rejects an alias below the free-plan minimum length", async () => {
    const response = await patch(ALIAS, JSON.stringify({ alias: "abc" }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("bad_request");
    expect(body.error.message).toContain("at least 6 characters");
    expect(await findLink(ALIAS)).toBeDefined();
  });

  test("PATCH rejects an alias already taken on the domain, ignoring case", async () => {
    const response = await patch(ALIAS, JSON.stringify({ alias: OTHER_ALIAS.toUpperCase() }));
    expect(response.status).toBe(409);
    expect((await response.json()).error).toMatchObject({
      code: "conflict",
      message: "Alias already exists",
    });
  });

  test("PATCH renames to a valid alias and keeps the id and creation time", async () => {
    const id = (await findLink(ALIAS))?.id;
    const response = await patch(ALIAS, JSON.stringify({ alias: "alias-route-renamed" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id,
      shortLink: `https://${DEFAULT_PLATFORM_DOMAIN}/alias-route-renamed`,
      url: "https://example.com",
      alias: "alias-route-renamed",
      createdAt: CREATED_AT.toISOString(),
      expiresAt: null,
      activatesAt: null,
      expiresAfter: null,
    });
  });

  const OTHER_PLATFORM_DOMAIN = PLATFORM_DOMAINS.find((d) => d !== DEFAULT_PLATFORM_DOMAIN)!;

  test("PATCH moves the link to another domain and keeps the old short URL", async () => {
    const id = (await findLink(ALIAS))?.id;
    const response = await patch(ALIAS, JSON.stringify({ domain: OTHER_PLATFORM_DOMAIN }));
    expect(response.status).toBe(200);
    expect((await response.json()).shortLink).toBe(`https://${OTHER_PLATFORM_DOMAIN}/${ALIAS}`);

    expect((await resolveLink(OTHER_PLATFORM_DOMAIN, ALIAS))?.id).toBe(id);
    expect((await resolveLink(DEFAULT_PLATFORM_DOMAIN, ALIAS))?.id).toBe(id);
  });

  test("PATCH rejects a move onto a domain where the alias is taken", async () => {
    await db.insert(schema.link).values({
      url: "https://example.com",
      alias: ALIAS,
      domain: OTHER_PLATFORM_DOMAIN,
      userId: OTHER_USER_ID,
    });
    const response = await patch(ALIAS, JSON.stringify({ domain: OTHER_PLATFORM_DOMAIN }));
    expect(response.status).toBe(409);
    expect((await response.json()).error).toMatchObject({
      code: "conflict",
      message: "Alias already exists",
    });
    expect((await findLink(ALIAS))?.domain).toBe(DEFAULT_PLATFORM_DOMAIN);
  });

  test("PATCH rejects a move onto a domain the key can't use", async () => {
    const response = await patch(ALIAS, JSON.stringify({ domain: "not-owned.example" }));
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("forbidden");
  });

  test("PATCH answers bad input with JSON errors", async () => {
    const malformed = await patch(ALIAS, "{");
    expect(malformed.status).toBe(400);
    expect((await malformed.json()).error.code).toBe("invalid_json");

    const unknownField = await patch(ALIAS, JSON.stringify({ userId: OTHER_USER_ID }));
    expect(unknownField.status).toBe(400);
    const body = await unknownField.json();
    expect(body.error.code).toBe("validation_failed");
    expect(body.error.details.length).toBeGreaterThan(0);
  });

  test("DELETE removes the key owner's link", async () => {
    const response = await remove(ALIAS);
    expect(response.status).toBe(204);
    expect(await findLink(ALIAS)).toBeUndefined();
  });

  test("DELETE does not reach another account's link", async () => {
    const response = await remove(OTHER_ALIAS);
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("not_found");
    expect(await findLink(OTHER_ALIAS)).toBeDefined();
  });
});
