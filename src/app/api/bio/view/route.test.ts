import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

import { env } from "@/env.mjs";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";

import { POST } from "./route";

// Runs against a disposable MySQL with the schema pushed (test/setup.ts points
// the app's db client at it); see CONTRIBUTING.md, "Database tests".
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("POST /api/bio/view (MySQL)", () => {
  const USER_ID = "bio_view_route_test";
  const SLUG = "bio-view-route-test";
  // OpenNext reads the request context from this global. No KV or queue
  // binding, so the view is ingested inline; waitUntil collects the background
  // task so each test can wait for the write.
  const CLOUDFLARE_CONTEXT = Symbol.for("__cloudflare-context__");
  let pending: Promise<unknown>[] = [];
  let pageId = 0;

  beforeAll(() => {
    // Another test file replaces @/env.mjs with a partial object for the whole
    // run, dropping DATABASE_URL; the app's db client reads it on first use.
    if (!env.DATABASE_URL) Object.assign(env, { DATABASE_URL: testDatabaseUrl });
    Reflect.set(globalThis, CLOUDFLARE_CONTEXT, {
      env: {},
      cf: {},
      ctx: { waitUntil: (promise: Promise<unknown>) => pending.push(promise) },
    });
  });

  async function cleanup() {
    const pages = await db.query.bioPage.findMany({ where: eq(schema.bioPage.userId, USER_ID) });
    for (const page of pages) {
      await db.delete(schema.bioPageView).where(eq(schema.bioPageView.bioPageId, page.id));
      await db
        .delete(schema.uniqueBioPageView)
        .where(eq(schema.uniqueBioPageView.bioPageId, page.id));
    }
    await db.delete(schema.bioPage).where(eq(schema.bioPage.userId, USER_ID));
    await db.delete(schema.user).where(eq(schema.user.id, USER_ID));
  }

  beforeEach(async () => {
    pending = [];
    await cleanup();
    await db.insert(schema.user).values({ id: USER_ID, email: `${USER_ID}@example.com` });
    const [inserted] = await db
      .insert(schema.bioPage)
      .values({ userId: USER_ID, slug: SLUG, isPublished: true });
    pageId = Number(inserted.insertId);
  });

  afterAll(async () => {
    Reflect.deleteProperty(globalThis, CLOUDFLARE_CONTEXT);
    await cleanup();
  });

  // The beacon's own Referer is always the bio page; the body carries the
  // visitor's source. No client IP header, so the per-IP rate limit is skipped.
  async function recordView(host: string, body: { referrer?: string }) {
    const response = await POST(
      new NextRequest(`https://${host}/api/bio/view`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          referer: `https://${host}/p/${SLUG}`,
          "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
        },
        body: JSON.stringify({ bioPageId: pageId, ...body }),
      }),
    );
    expect(response.status).toBe(204);
    await Promise.all(pending);
    const views = await db.query.bioPageView.findMany({
      where: eq(schema.bioPageView.bioPageId, pageId),
      orderBy: (t, { asc }) => [asc(t.id)],
    });
    return views.map((v) => v.referer);
  }

  test("records the referrer from the body, not the beacon's Referer header", async () => {
    expect(await recordView("ishortn.ink", { referrer: "https://www.instagram.com/" })).toEqual([
      "instagram",
    ]);
  });

  test("records a missing or empty referrer as direct", async () => {
    expect(await recordView("ishortn.ink", { referrer: "" })).toEqual(["direct"]);
    expect(await recordView("ishortn.ink", {})).toEqual(["direct", "direct"]);
  });

  test("records a referrer on the bio page's own host as direct", async () => {
    expect(await recordView("ishortn.ink", { referrer: `https://ishortn.ink/p/${SLUG}` })).toEqual([
      "direct",
    ]);
  });

  test("custom-domain pages use the body referrer and treat their own host as direct", async () => {
    const views = await recordView("links.example.com", { referrer: "https://t.co/abc" });
    expect(views).toEqual(["x"]);
    expect(
      await recordView("links.example.com", { referrer: "https://www.links.example.com/" }),
    ).toEqual(["x", "direct"]);
  });

  test("rejects an oversized referrer", async () => {
    const response = await POST(
      new NextRequest("https://ishortn.ink/api/bio/view", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bioPageId: pageId, referrer: `https://a.com/${"x".repeat(2048)}` }),
      }),
    );
    expect(response.status).toBe(400);
  });
});
