import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { eq, inArray, like } from "drizzle-orm";

import { env } from "@/env.mjs";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";

import { runPhishingRescan } from ".";

// Runs against a disposable MySQL with the schema pushed (test/setup.ts points
// the app's db client at it); see CONTRIBUTING.md, "Database tests".
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("phishing rescan backlog (MySQL)", () => {
  const FREE_USER = "rescan_backlog_free";
  const PAID_USER = "rescan_backlog_paid";
  const WAITING = 300;
  let linkIds: number[] = [];

  beforeAll(() => {
    if (!env.DATABASE_URL) Object.assign(env, { DATABASE_URL: testDatabaseUrl });
  });

  async function cleanup() {
    const links = await db
      .select({ id: schema.link.id })
      .from(schema.link)
      .where(inArray(schema.link.userId, [FREE_USER, PAID_USER]));
    if (links.length > 0) {
      await db.delete(schema.flaggedLink).where(
        inArray(
          schema.flaggedLink.linkId,
          links.map((l) => l.id),
        ),
      );
    }
    await db.delete(schema.link).where(inArray(schema.link.userId, [FREE_USER, PAID_USER]));
    await db
      .delete(schema.blockedDomain)
      .where(like(schema.blockedDomain.domain, "login%.evil.example"));
    await db.delete(schema.subscription).where(eq(schema.subscription.userId, PAID_USER));
    await db.delete(schema.user).where(inArray(schema.user.id, [FREE_USER, PAID_USER]));
  }

  beforeEach(async () => {
    await cleanup();
    await db.insert(schema.user).values([
      { id: FREE_USER, email: `${FREE_USER}@example.com` },
      { id: PAID_USER, email: `${PAID_USER}@example.com` },
    ]);
    await db
      .insert(schema.subscription)
      .values({ userId: PAID_USER, status: "active", plan: "pro" });
    await db.insert(schema.link).values(
      Array.from({ length: WAITING + 1 }, (_, i) => ({
        url: `https://login${i}.evil.example/`,
        alias: `rescan-backlog-${i}`,
        domain: "isht.ink",
        userId: i === 0 ? PAID_USER : FREE_USER,
      })),
    );
    const links = await db
      .select({ id: schema.link.id })
      .from(schema.link)
      .where(inArray(schema.link.userId, [FREE_USER, PAID_USER]))
      .orderBy(schema.link.id);
    linkIds = links.map((l) => l.id);
    // What a run that hit the cap leaves behind.
    await db.insert(schema.flaggedLink).values(
      linkIds.map((linkId, i) => ({
        linkId,
        reason: "phishing-rescan: phishing-database-domains",
        details: `Destination host listed in feed: login${i}.evil.example (over the 250 auto-block limit for one run)`,
      })),
    );
  });

  afterAll(cleanup);

  test("drains the backlog over consecutive runs and reports what is left", async () => {
    const first = await runPhishingRescan({ dryRun: false, backlogOnly: true });
    expect(first).toMatchObject({ blocked: 249, flagged: 1, backlog: 51, domainsBlocked: 249 });

    const second = await runPhishingRescan({ dryRun: false, backlogOnly: true });
    expect(second).toMatchObject({ blocked: 51, flagged: 0, backlog: 0 });

    const links = await db
      .select({ id: schema.link.id, blocked: schema.link.blocked })
      .from(schema.link)
      .where(inArray(schema.link.id, linkIds));
    expect(links.filter((l) => l.blocked)).toHaveLength(WAITING);

    const flags = await db
      .select()
      .from(schema.flaggedLink)
      .where(inArray(schema.flaggedLink.linkId, linkIds));
    expect(flags.filter((f) => f.status === "blocked")).toHaveLength(WAITING);
    // The paying account's link stays live and pending review, out of the backlog.
    const paying = flags.find((f) => f.linkId === linkIds[0]);
    expect(paying?.status).toBe("pending");
    expect(paying?.details).toEndWith("(paying account, review before blocking)");

    expect(await runPhishingRescan({ dryRun: false, backlogOnly: true })).toMatchObject({
      blocked: 0,
      backlog: 0,
    });
  });

  test("a dry run reports the backlog without writing", async () => {
    const result = await runPhishingRescan({ dryRun: true, backlogOnly: true });
    expect(result).toMatchObject({ blocked: 249, flagged: 1, backlog: 51 });
    const blocked = await db
      .select({ id: schema.link.id })
      .from(schema.link)
      .where(eq(schema.link.blocked, true));
    expect(blocked.filter((l) => linkIds.includes(l.id))).toHaveLength(0);
  });
});
