import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { eq, inArray } from "drizzle-orm";

import { env } from "@/env.mjs";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";

import { expandUrl } from "./expand";
import { resolveOwnLink } from "./own-link";

import type { ExpandDeps } from "./expand";

// Runs against a disposable MySQL with the schema pushed (test/setup.ts points
// the app's db client at it); see CONTRIBUTING.md, "Database tests".
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("expanding iShortn links (MySQL)", () => {
  const USER_ID = "url_expander_test";
  const fetched: string[] = [];
  const deps: ExpandDeps = {
    fetch: async (url) => {
      fetched.push(url);
      return new Response(null, { status: 200 });
    },
    checkUrl: async () => "public",
    resolveOwnLink,
    checkSafety: async () => ({ status: "safe" }),
  };

  // OpenNext reads the request context from this global; resolveLink fills the
  // link cache through waitUntil. Collected so the visit check also covers background work.
  const CLOUDFLARE_CONTEXT = Symbol.for("__cloudflare-context__");
  const background: Promise<unknown>[] = [];

  beforeAll(() => {
    Reflect.set(globalThis, CLOUDFLARE_CONTEXT, {
      env: {},
      cf: {},
      ctx: { waitUntil: (task: Promise<unknown>) => void background.push(task) },
    });
    if (!env.DATABASE_URL) Object.assign(env, { DATABASE_URL: testDatabaseUrl });
  });

  async function cleanup() {
    const links = await db
      .select({ id: schema.link.id })
      .from(schema.link)
      .where(eq(schema.link.userId, USER_ID));
    const ids = links.map((row) => row.id);
    if (ids.length) {
      await db.delete(schema.linkVisit).where(inArray(schema.linkVisit.linkId, ids));
      await db.delete(schema.uniqueLinkVisit).where(inArray(schema.uniqueLinkVisit.linkId, ids));
    }
    await db.delete(schema.link).where(eq(schema.link.userId, USER_ID));
    await db.delete(schema.customDomain).where(eq(schema.customDomain.userId, USER_ID));
    await db.delete(schema.user).where(eq(schema.user.id, USER_ID));
  }

  beforeEach(async () => {
    fetched.length = 0;
    await cleanup();
    await db.insert(schema.user).values({ id: USER_ID, email: "expander@example.com" });
  });

  afterAll(cleanup);

  const visitCounts = async (linkId: number) => ({
    visits: (await db.select().from(schema.linkVisit).where(eq(schema.linkVisit.linkId, linkId)))
      .length,
    unique: (
      await db
        .select()
        .from(schema.uniqueLinkVisit)
        .where(eq(schema.uniqueLinkVisit.linkId, linkId))
    ).length,
  });

  test("reads the destination from the database and records no visit", async () => {
    const [inserted] = await db
      .insert(schema.link)
      .values({
        userId: USER_ID,
        alias: "xpand-test",
        domain: "ishortn.ink",
        url: "https://example.com/sale",
        utmParams: { utm_source: "newsletter" },
      })
      .$returningId();

    const result = await expandUrl("https://ishortn.ink/Xpand-Test", deps);

    expect(result.ok && result.hops).toEqual([
      { url: "https://ishortn.ink/Xpand-Test", status: 307, ishortn: true },
      { url: "https://example.com/sale?utm_source=newsletter", status: 200 },
    ]);
    expect(fetched).toEqual(["https://example.com/sale?utm_source=newsletter"]);
    await Promise.all(background);
    expect(await visitCounts(inserted!.id)).toEqual({ visits: 0, unique: 0 });
  });

  test("resolves links on an active custom domain", async () => {
    await db.insert(schema.customDomain).values({
      userId: USER_ID,
      domain: "go.expander-test.example",
      status: "active",
    });
    await db.insert(schema.link).values({
      userId: USER_ID,
      alias: "promo",
      domain: "go.expander-test.example",
      url: "https://example.com/promo",
    });

    expect(await resolveOwnLink(new URL("https://go.expander-test.example/promo"))).toEqual({
      type: "redirect",
      location: "https://example.com/promo",
    });
  });

  test("hides the destination of a password-protected link", async () => {
    await db.insert(schema.link).values({
      userId: USER_ID,
      alias: "xpand-secret",
      domain: "ishortn.ink",
      url: "https://example.com/secret",
      passwordHash: "hash",
    });

    const outcome = await resolveOwnLink(new URL("https://ishortn.ink/xpand-secret"));
    expect(outcome).toMatchObject({ type: "stop", status: 200 });
    expect(JSON.stringify(outcome)).not.toContain("example.com/secret");
  });

  test("treats app pages as pages and other hosts as not ours", async () => {
    expect(await resolveOwnLink(new URL("https://ishortn.ink/pricing"))).toEqual({ type: "page" });
    expect(await resolveOwnLink(new URL("https://ishortn.ink/"))).toEqual({ type: "page" });
    expect(await resolveOwnLink(new URL("https://ishortn.ink/xpand-none"))).toEqual({
      type: "missing",
    });
    expect(await resolveOwnLink(new URL("https://bit.ly/xpand-test"))).toBeNull();
  });
});
