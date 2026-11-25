import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { subDays } from "date-fns";
import { eq, inArray } from "drizzle-orm";

import { env } from "@/env.mjs";
import { PLAN_VARIANT_IDS } from "@/lib/billing/plans";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";

import {
  getSharedStats,
  getStatsShare,
  resetStatsShare,
  setStatsShare,
} from "./stats-share.service";

import type { WorkspaceTRPCContext } from "../../trpc";

// Runs against a disposable MySQL with the schema pushed (test/setup.ts points
// the app's db client at it); see CONTRIBUTING.md, "Database tests".
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("shared link stats (MySQL)", () => {
  const FREE_USER = "stats_share_free_test";
  const PRO_USER = "stats_share_pro_test";
  const USERS = [FREE_USER, PRO_USER];
  const publicCtx = { db, headers: new Headers() };

  // SAFETY: the share services read only db, workspace and auth.userId.
  const ownerCtx = (userId: string) =>
    ({
      db,
      headers: new Headers(),
      auth: { userId },
      workspace: {
        type: "personal",
        userId,
        teamId: null,
        teamSlug: null,
        role: "owner",
        plan: userId === PRO_USER ? "pro" : "free",
      },
    }) as WorkspaceTRPCContext;

  beforeAll(() => {
    // Another test file replaces @/env.mjs with a partial object for the whole run; the db client
    // and the share URL read these on first use.
    if (!env.DATABASE_URL) Object.assign(env, { DATABASE_URL: testDatabaseUrl });
    if (!env.NEXT_PUBLIC_APP_URL)
      Object.assign(env, { NEXT_PUBLIC_APP_URL: "https://ishortn.ink" });
  });

  async function cleanup() {
    const links = await db
      .select({ id: schema.link.id })
      .from(schema.link)
      .where(inArray(schema.link.userId, USERS));
    const linkIds = links.map((row) => row.id);
    if (linkIds.length) {
      await db.delete(schema.linkVisit).where(inArray(schema.linkVisit.linkId, linkIds));
      await db
        .delete(schema.uniqueLinkVisit)
        .where(inArray(schema.uniqueLinkVisit.linkId, linkIds));
      await db.delete(schema.flaggedLink).where(inArray(schema.flaggedLink.linkId, linkIds));
    }
    await db.delete(schema.link).where(inArray(schema.link.userId, USERS));
    await db.delete(schema.subscription).where(inArray(schema.subscription.userId, USERS));
    await db.delete(schema.user).where(inArray(schema.user.id, USERS));
  }

  async function seedLink(userId: string, alias: string, values: Partial<schema.NewLink> = {}) {
    const inserted = await db.insert(schema.link).values({
      url: "https://example.com/private-destination",
      alias,
      domain: "isht.app",
      userId,
      ...values,
    });
    const linkId = inserted[0].insertId;
    const now = new Date();
    const visitor = { device: "Desktop", browser: "Chrome", os: "macOS" };
    await db.insert(schema.linkVisit).values([
      {
        ...visitor,
        linkId,
        country: "GH",
        city: "Accra",
        referer: "twitter",
        createdAt: subDays(now, 2),
      },
      { ...visitor, linkId, country: "US", city: "Austin", createdAt: subDays(now, 20) },
    ]);
    await db
      .insert(schema.uniqueLinkVisit)
      .values([{ linkId, ipHash: "a".repeat(64), createdAt: subDays(now, 2) }]);
    return linkId;
  }

  async function share(userId: string, linkId: number) {
    const state = await setStatsShare(ownerCtx(userId), { id: linkId, enabled: true });
    return state.url!.split("/stats/")[1]!;
  }

  beforeEach(async () => {
    await cleanup();
    await db.insert(schema.user).values([
      { id: FREE_USER, email: `${FREE_USER}@example.com` },
      { id: PRO_USER, email: `${PRO_USER}@example.com` },
    ]);
    await db.insert(schema.subscription).values({
      userId: PRO_USER,
      status: "active",
      plan: "pro",
      variantId: PLAN_VARIANT_IDS.pro.monthly,
    });
  }, 30_000);

  afterAll(cleanup);

  test("a shared Free link shows the last 7 days only, without the destination", async () => {
    const linkId = await seedLink(FREE_USER, "ss-free", { name: "Launch" });
    const token = await share(FREE_USER, linkId);

    const page = await getSharedStats(publicCtx, { token, range: "all" });
    expect(page).toMatchObject({ shortLink: "isht.app/ss-free", title: "Launch", range: "7d" });
    expect(page?.isPaidPlan).toBe(false);
    expect(page?.stats.totalClicks).toBe(1);
    expect(page?.stats.countries).toEqual({ GH: 1 });
    expect(JSON.stringify(page)).not.toContain("private-destination");
    expect(JSON.stringify(page)).not.toContain(FREE_USER);
  });

  test("a Pro link gets the range it asks for", async () => {
    const linkId = await seedLink(PRO_USER, "ss-pro");
    const token = await share(PRO_USER, linkId);

    const page = await getSharedStats(publicCtx, { token, range: "30d" });
    expect(page?.range).toBe("30d");
    expect(page?.stats.totalClicks).toBe(2);
  });

  test("turning sharing off or resetting the link ends the old URL at once", async () => {
    const linkId = await seedLink(FREE_USER, "ss-revoke");
    const first = await share(FREE_USER, linkId);

    const reset = await resetStatsShare(ownerCtx(FREE_USER), { id: linkId });
    const second = reset.url!.split("/stats/")[1]!;
    expect(second).not.toBe(first);
    expect(await getSharedStats(publicCtx, { token: first })).toBeNull();
    expect(await getSharedStats(publicCtx, { token: second })).not.toBeNull();

    await setStatsShare(ownerCtx(FREE_USER), { id: linkId, enabled: false });
    expect(await getSharedStats(publicCtx, { token: second })).toBeNull();
    expect((await getStatsShare(ownerCtx(FREE_USER), { id: linkId })).url).toBeNull();
  });

  test("a legacy publicStats link exposes nothing", async () => {
    await seedLink(FREE_USER, "ss-legacy", { publicStats: true });
    const [row] = await db
      .select({ token: schema.link.statsShareToken })
      .from(schema.link)
      .where(eq(schema.link.alias, "ss-legacy"));
    expect(row?.token).toBeNull();
    expect(await getSharedStats(publicCtx, { token: "" })).toBeNull();
  });

  test("blocked, disabled and flagged links and banned or restricted owners are hidden", async () => {
    const linkId = await seedLink(FREE_USER, "ss-hidden");
    const token = await share(FREE_USER, linkId);
    const hidden = async () => (await getSharedStats(publicCtx, { token })) === null;
    const linkWhere = eq(schema.link.id, linkId);
    const userWhere = eq(schema.user.id, FREE_USER);

    await db.update(schema.link).set({ disabled: true }).where(linkWhere);
    expect(await hidden()).toBe(true);
    await db.update(schema.link).set({ disabled: false, blocked: true }).where(linkWhere);
    expect(await hidden()).toBe(true);
    await db.update(schema.link).set({ blocked: false }).where(linkWhere);
    expect(await hidden()).toBe(false);

    await db.insert(schema.flaggedLink).values({ linkId, reason: "phishing" });
    expect(await hidden()).toBe(true);
    await db
      .update(schema.flaggedLink)
      .set({ status: "dismissed" })
      .where(eq(schema.flaggedLink.linkId, linkId));
    expect(await hidden()).toBe(false);

    await db.update(schema.user).set({ banned: true }).where(userWhere);
    expect(await hidden()).toBe(true);
    await db.update(schema.user).set({ banned: false, restrictedAt: new Date() }).where(userWhere);
    expect(await hidden()).toBe(true);
  });

  test("deleting the link ends its page", async () => {
    const linkId = await seedLink(FREE_USER, "ss-deleted");
    const token = await share(FREE_USER, linkId);
    await db.delete(schema.link).where(eq(schema.link.id, linkId));
    expect(await getSharedStats(publicCtx, { token })).toBeNull();
  });
});
