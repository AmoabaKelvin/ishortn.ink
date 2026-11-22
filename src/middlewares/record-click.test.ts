import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { eq } from "drizzle-orm";

import { env } from "@/env.mjs";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";

import { resolveLink } from "./record-click";

// Runs against a disposable MySQL with the schema pushed (test/setup.ts points
// the app's db client at it); see CONTRIBUTING.md, "Database tests".
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("resolveLink (MySQL)", () => {
  const USER_ID = "resolve_link_domain_test";
  const ALIAS = "resolve-domain-test";
  // OpenNext reads the request context from this global. resolveLink caches hits
  // through waitUntil, so give it a context with no KV binding and a no-op waitUntil.
  const CLOUDFLARE_CONTEXT = Symbol.for("__cloudflare-context__");

  beforeAll(() => {
    // Another test file replaces @/env.mjs with a partial object for the whole
    // run, dropping DATABASE_URL; the app's db client reads it on first use.
    if (!env.DATABASE_URL) Object.assign(env, { DATABASE_URL: testDatabaseUrl });
    Reflect.set(globalThis, CLOUDFLARE_CONTEXT, {
      env: {},
      cf: {},
      ctx: { waitUntil: () => {} },
    });
  });

  async function cleanup() {
    await db.delete(schema.link).where(eq(schema.link.userId, USER_ID));
    await db.delete(schema.user).where(eq(schema.user.id, USER_ID));
  }

  beforeEach(async () => {
    await cleanup();
    await db.insert(schema.user).values({ id: USER_ID, email: `${USER_ID}@example.com` });
    await db.insert(schema.link).values({
      userId: USER_ID,
      url: "https://example.com/isht-app",
      alias: ALIAS,
      domain: "isht.app",
    });
  });

  afterAll(async () => {
    Reflect.deleteProperty(globalThis, CLOUDFLARE_CONTEXT);
    await cleanup();
  });

  test("a link created on isht.app resolves only on isht.app", async () => {
    const resolved = await resolveLink("isht.app", ALIAS);
    expect(resolved?.url).toBe("https://example.com/isht-app");
    expect(await resolveLink("https://www.isht.app", ALIAS.toUpperCase())).not.toBeNull();

    expect(await resolveLink("isht.ink", ALIAS)).toBeNull();
    expect(await resolveLink("ishortn.ink", ALIAS)).toBeNull();
  });
});
