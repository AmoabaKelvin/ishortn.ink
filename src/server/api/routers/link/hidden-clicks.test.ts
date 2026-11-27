import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { subDays } from "date-fns";
import { eq, inArray } from "drizzle-orm";

import { env } from "@/env.mjs";
import { DEFAULT_PLATFORM_DOMAIN } from "@/lib/constants/domains";
import { bucketKey, freeAnalyticsWindowStart } from "@/lib/core/analytics";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";

import { countClicksBefore } from "./link.service";

// Runs against a disposable MySQL with the schema pushed (test/setup.ts points
// the app's db client at it); see CONTRIBUTING.md, "Database tests".
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("countClicksBefore (MySQL)", () => {
  const USER = "hidden_clicks_test";
  const now = new Date();
  const windowStart = freeAnalyticsWindowStart(now);
  const linkIds: number[] = [];

  async function cleanup() {
    const links = await db
      .select({ id: schema.link.id })
      .from(schema.link)
      .where(eq(schema.link.userId, USER));
    const ids = links.map((row) => row.id);
    if (ids.length) {
      await db.delete(schema.linkVisit).where(inArray(schema.linkVisit.linkId, ids));
      await db
        .delete(schema.linkVisitDailySummary)
        .where(inArray(schema.linkVisitDailySummary.linkId, ids));
    }
    await db.delete(schema.link).where(eq(schema.link.userId, USER));
    await db.delete(schema.user).where(eq(schema.user.id, USER));
  }

  beforeAll(async () => {
    // Another test file replaces @/env.mjs with a partial object for the whole
    // run, dropping DATABASE_URL; the app's db client reads it on first use.
    if (!env.DATABASE_URL) Object.assign(env, { DATABASE_URL: testDatabaseUrl });
    await cleanup();
    await db.insert(schema.user).values({ id: USER });
    for (const alias of ["hidden-clicks-a", "hidden-clicks-b"]) {
      const inserted = await db.insert(schema.link).values({
        url: "https://example.com",
        alias,
        domain: DEFAULT_PLATFORM_DOMAIN,
        userId: USER,
      });
      linkIds.push(inserted[0].insertId);
    }
    const [a = 0, b = 0] = linkIds;
    await db.insert(schema.linkVisit).values([
      // Inside the window: shown, not hidden.
      { linkId: a, createdAt: now },
      { linkId: a, createdAt: windowStart },
      // Before it: hidden.
      { linkId: a, createdAt: new Date(windowStart.getTime() - 1000) },
      { linkId: a, createdAt: subDays(now, 20) },
      { linkId: b, createdAt: subDays(now, 10) },
    ]);
    await db.insert(schema.linkVisitDailySummary).values([
      { linkId: a, date: bucketKey(subDays(now, 60)), clicks: 40, uniqueClicks: 30 },
      { linkId: b, date: bucketKey(subDays(now, 90)), clicks: 1000, uniqueClicks: 5 },
      // An archived day inside the window is shown, so it isn't hidden.
      { linkId: b, date: bucketKey(windowStart), clicks: 7, uniqueClicks: 7 },
    ]);
  });

  afterAll(cleanup);

  test("counts raw and archived clicks before the window for one link", async () => {
    expect(await countClicksBefore(db, [linkIds[0]!], windowStart)).toBe(2 + 40);
  });

  test("sums across links", async () => {
    expect(await countClicksBefore(db, linkIds, windowStart)).toBe(2 + 40 + 1 + 1000);
  });

  test("takes a subquery of link ids", async () => {
    const userLinks = db
      .select({ id: schema.link.id })
      .from(schema.link)
      .where(eq(schema.link.userId, USER));
    expect(await countClicksBefore(db, userLinks, windowStart)).toBe(2 + 40 + 1 + 1000);
  });

  test("is zero with no older clicks or no links", async () => {
    expect(await countClicksBefore(db, linkIds, subDays(now, 365))).toBe(0);
    expect(await countClicksBefore(db, [], windowStart)).toBe(0);
  });
});
