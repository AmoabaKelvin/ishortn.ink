import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { eq, inArray, like } from "drizzle-orm";

import { env } from "@/env.mjs";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";

import { checkCampaignPatterns, loadBlockedPhishingPaths, runPhishingRescan } from ".";

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

  test("dismisses pending flags left by matches without URL-level evidence", async () => {
    const legacy = [
      "Destination host listed in feed, on a shared host: sites.google.com",
      "Feed lists the home page of a shared or major host: https://www.amazon.com/",
    ];
    await db.insert(schema.flaggedLink).values(
      legacy.map((details) => ({
        linkId: linkIds[1]!,
        reason: "phishing-rescan: phishing-database-domains",
        details,
      })),
    );
    const pendingLegacy = async () =>
      (
        await db
          .select()
          .from(schema.flaggedLink)
          .where(inArray(schema.flaggedLink.linkId, linkIds))
      ).filter((f) => f.status === "pending" && legacy.includes(f.details ?? ""));

    await runPhishingRescan({ dryRun: true, backlogOnly: true });
    expect(await pendingLegacy()).toHaveLength(2);

    await runPhishingRescan({ dryRun: false, backlogOnly: true });
    expect(await pendingLegacy()).toHaveLength(0);
    const dismissed = await db
      .select()
      .from(schema.flaggedLink)
      .where(eq(schema.flaggedLink.status, "dismissed"));
    expect(dismissed.filter((f) => legacy.includes(f.details ?? ""))).toHaveLength(2);

    // The backlog is untouched by the cleanup.
    expect(await runPhishingRescan({ dryRun: false, backlogOnly: true })).toMatchObject({
      blocked: 51,
      backlog: 0,
    });
  });
});

describe.skipIf(!testDatabaseUrl)("campaign patterns on link writes (MySQL)", () => {
  const FREE_USER = "campaign_pattern_free";
  const PAID_USER = "campaign_pattern_paid";
  const USERS = [FREE_USER, PAID_USER];
  const KIT_PATH =
    "/ratingdocumentsdocumtesdcopycodesprojectinnobb/richdocumentationandpresentationsofliddy/";

  beforeAll(() => {
    if (!env.DATABASE_URL) Object.assign(env, { DATABASE_URL: testDatabaseUrl });
  });

  async function cleanup() {
    const links = await db
      .select({ id: schema.link.id })
      .from(schema.link)
      .where(inArray(schema.link.userId, USERS));
    if (links.length > 0) {
      await db.delete(schema.flaggedLink).where(
        inArray(
          schema.flaggedLink.linkId,
          links.map((l) => l.id),
        ),
      );
    }
    await db.delete(schema.link).where(inArray(schema.link.userId, USERS));
    await db.delete(schema.subscription).where(eq(schema.subscription.userId, PAID_USER));
    await db.delete(schema.user).where(inArray(schema.user.id, USERS));
  }

  async function insertLink(alias: string, url: string, userId: string, blockedReason?: string) {
    const [result] = await db.insert(schema.link).values({
      url,
      alias,
      domain: "isht.ink",
      userId,
      ...(blockedReason && { blocked: true, blockedAt: new Date(), blockedReason }),
    });
    return Number(result.insertId);
  }

  async function state(linkId: number) {
    const [row] = await db
      .select({ blocked: schema.link.blocked, blockedReason: schema.link.blockedReason })
      .from(schema.link)
      .where(eq(schema.link.id, linkId));
    const flags = await db
      .select({ status: schema.flaggedLink.status, reason: schema.flaggedLink.reason })
      .from(schema.flaggedLink)
      .where(eq(schema.flaggedLink.linkId, linkId));
    return { blocked: row?.blocked, blockedReason: row?.blockedReason, flags };
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
    await insertLink(
      "campaign-blocked",
      `https://first-compromised.example${KIT_PATH}`,
      FREE_USER,
      "Phishing: fake Microsoft Teams sign-in",
    );
  });

  afterAll(cleanup);

  test("blocks a free account's link that reuses a blocked phishing path", async () => {
    const url = `https://other-compromised.example${KIT_PATH}?r=1`;
    const id = await insertLink("campaign-free", url, FREE_USER);
    await checkCampaignPatterns([{ linkId: id, url }], loadBlockedPhishingPaths);
    expect(await state(id)).toEqual({
      blocked: true,
      blockedReason: "phishing-rescan: campaign-pattern",
      flags: [{ status: "blocked", reason: "phishing-rescan: campaign-pattern" }],
    });
  });

  test("blocks a free account's link to the exact URL already blocked for phishing", async () => {
    const url = `https://first-compromised.example${KIT_PATH}`;
    const id = await insertLink("campaign-same-url", url, FREE_USER);
    await checkCampaignPatterns([{ linkId: id, url }], loadBlockedPhishingPaths);
    expect((await state(id)).blocked).toBe(true);
  });

  test("only flags a paying account's link, including an email in a redirect", async () => {
    const url = "https://www.google.com/url?q=https://evil.example/&sa=D#x=jane@acme.com";
    const id = await insertLink("campaign-paid", url, PAID_USER);
    await checkCampaignPatterns([{ linkId: id, url }], loadBlockedPhishingPaths);
    expect(await state(id)).toEqual({
      blocked: false,
      blockedReason: null,
      flags: [{ status: "pending", reason: "phishing-rescan: campaign-pattern" }],
    });
  });

  test("ignores paths of links blocked on host-level evidence only", async () => {
    const feedPath = "/shared-hosting-control-panel/customer-dashboard/";
    await insertLink(
      "campaign-domain-feed",
      `https://listed-host.example${feedPath}`,
      FREE_USER,
      "phishing-rescan: phishing-database-domains",
    );
    const url = `https://unrelated.example${feedPath}`;
    const id = await insertLink("campaign-feed-path", url, FREE_USER);
    await checkCampaignPatterns([{ linkId: id, url }], loadBlockedPhishingPaths);
    expect(await state(id)).toEqual({ blocked: false, blockedReason: null, flags: [] });
  });

  test("leaves a link that matches nothing alone", async () => {
    const url = "https://example.com/blog/a-long-post-about-shortening-links-well";
    const id = await insertLink("campaign-normal", url, FREE_USER);
    await checkCampaignPatterns([{ linkId: id, url }], loadBlockedPhishingPaths);
    expect(await state(id)).toEqual({ blocked: false, blockedReason: null, flags: [] });
  });
});
