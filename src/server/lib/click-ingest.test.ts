import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { eq } from "drizzle-orm";

import { env } from "@/env.mjs";
import { describeVisitor } from "@/lib/core/analytics/visitor";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";

import { ingestClickBatch } from "./click-ingest";

// Runs against a disposable MySQL with the schema pushed (test/setup.ts points
// the app's db client at it); see CONTRIBUTING.md, "Database tests".
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("ingestClickBatch (MySQL)", () => {
  const USER_ID = "click_ingest_test";
  // ua-parser-js takes the Android device model verbatim from the User-Agent.
  const LONG_MODEL_UA = `Mozilla/5.0 (Linux; Android 10; ${"X".repeat(220)} Build/QP1A.190711.020) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36`;
  // OpenNext reads the request context from this global; milestone checks run through waitUntil.
  const CLOUDFLARE_CONTEXT = Symbol.for("__cloudflare-context__");
  let linkId = 0;

  async function cleanup() {
    const links = await db
      .select({ id: schema.link.id })
      .from(schema.link)
      .where(eq(schema.link.userId, USER_ID));
    for (const { id } of links) {
      await db.delete(schema.linkVisit).where(eq(schema.linkVisit.linkId, id));
      await db.delete(schema.uniqueLinkVisit).where(eq(schema.uniqueLinkVisit.linkId, id));
    }
    await db.delete(schema.link).where(eq(schema.link.userId, USER_ID));
    await db.delete(schema.user).where(eq(schema.user.id, USER_ID));
  }

  beforeAll(() => {
    if (!env.DATABASE_URL) Object.assign(env, { DATABASE_URL: testDatabaseUrl });
    Reflect.set(globalThis, CLOUDFLARE_CONTEXT, {
      env: {},
      cf: {},
      ctx: { waitUntil: () => {} },
    });
  });

  beforeEach(async () => {
    await cleanup();
    await db.insert(schema.user).values({ id: USER_ID, email: `${USER_ID}@example.com` });
    const [inserted] = await db.insert(schema.link).values({
      userId: USER_ID,
      url: "https://example.com",
      alias: "click-ingest-test",
    });
    linkId = Number(inserted.insertId);
  });

  afterAll(async () => {
    Reflect.deleteProperty(globalThis, CLOUDFLARE_CONTEXT);
    await cleanup();
  });

  // LinkVisit.model is varchar(191); an over-long value would fail the whole batch, and the
  // queue would retry and then dead-letter every other click in it.
  test("a click with an over-long User-Agent model is stored with the model truncated", async () => {
    const visitor = await describeVisitor({
      headers: new Headers({ "user-agent": LONG_MODEL_UA }),
      ip: "203.0.113.7",
      country: "GH",
      city: "Accra",
    });
    if (!visitor) throw new Error("expected a visitor, not a bot");

    await ingestClickBatch([
      {
        ...visitor,
        kind: "link",
        id: crypto.randomUUID(),
        linkId,
        ownerId: USER_ID,
        matchedGeoRuleId: null,
      },
    ]);

    const visits = await db
      .select({ model: schema.linkVisit.model, city: schema.linkVisit.city })
      .from(schema.linkVisit)
      .where(eq(schema.linkVisit.linkId, linkId));
    expect(visits).toEqual([{ model: "X".repeat(191), city: "Accra" }]);
  });
});
