import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { eq, inArray } from "drizzle-orm";

import { env } from "@/env.mjs";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";

import { sendScheduledReports, unsubscribeReportRecipient } from "./scheduled-reports";

import type { SendScheduledReportInput } from "./notifications/scheduled-report";

// Runs against a disposable MySQL with the schema pushed; see CONTRIBUTING.md, "Database tests".
// Sends go through a recorder, so no email leaves the test.
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

// Monday 23 Nov 2026: weekly reports cover 16-22 Nov, monthly ones October.
const NOW = new Date("2026-11-23T00:10:00Z");
const CREATED = new Date("2026-09-01T00:00:00Z");

describe.skipIf(!testDatabaseUrl)("scheduled reports job (MySQL)", () => {
  const PREFIX = "srp_test_";
  const PRO = `${PREFIX}pro`;
  const ULTRA = `${PREFIX}ultra`;
  const FREE = `${PREFIX}free`;
  const USERS = [PRO, ULTRA, FREE];
  const SHARE_TOKEN = `${PREFIX}share`;

  let sent: SendScheduledReportInput[] = [];
  let accept = true;
  const record = async (input: SendScheduledReportInput) => {
    sent.push(input);
    return accept;
  };
  const run = (options: Parameters<typeof sendScheduledReports>[0] = {}) =>
    sendScheduledReports({ now: NOW, send: record, sendIntervalMs: 0, ...options });

  const ids: Record<string, number> = {};
  const sentFor = (key: string) => sent.filter((item) => item.reportId === ids[key]);

  beforeAll(() => {
    // Another test file replaces @/env.mjs with a partial object for the whole run; the db client
    // and the stats URL read these on first use.
    if (!env.DATABASE_URL) Object.assign(env, { DATABASE_URL: testDatabaseUrl });
    if (!env.NEXT_PUBLIC_APP_URL) {
      Object.assign(env, { NEXT_PUBLIC_APP_URL: "https://ishortn.ink" });
    }
  });

  async function cleanup() {
    const links = await db
      .select({ id: schema.link.id })
      .from(schema.link)
      .where(inArray(schema.link.userId, USERS));
    if (links.length) {
      await db.delete(schema.linkVisit).where(
        inArray(
          schema.linkVisit.linkId,
          links.map((row) => row.id),
        ),
      );
    }
    await db.delete(schema.link).where(inArray(schema.link.userId, USERS));
    await db.delete(schema.folder).where(inArray(schema.folder.userId, USERS));
    await db.delete(schema.campaign).where(inArray(schema.campaign.userId, USERS));
    await db.delete(schema.scheduledReport).where(inArray(schema.scheduledReport.userId, USERS));
    await db.delete(schema.subscription).where(inArray(schema.subscription.userId, USERS));
    await db.delete(schema.user).where(inArray(schema.user.id, USERS));
  }

  async function addLink(
    userId: string,
    alias: string,
    extra: Partial<typeof schema.link.$inferInsert> = {},
  ) {
    const [result] = await db.insert(schema.link).values({
      url: "https://example.com",
      alias: `${PREFIX}${alias}`,
      userId,
      ...extra,
    });
    return result.insertId;
  }

  async function addVisits(
    linkId: number,
    total: number,
    createdAt: Date,
    visit: { country?: string; device?: string; referer?: string } = {},
  ) {
    await db
      .insert(schema.linkVisit)
      .values(Array.from({ length: total }, () => ({ linkId, createdAt, ...visit })));
  }

  async function addReport(
    key: string,
    values: Pick<
      typeof schema.scheduledReport.$inferInsert,
      "userId" | "targetType" | "targetId" | "frequency" | "recipients"
    > &
      Partial<typeof schema.scheduledReport.$inferInsert>,
  ) {
    const [result] = await db
      .insert(schema.scheduledReport)
      .values({ createdAt: CREATED, ...values });
    ids[key] = result.insertId;
  }

  beforeEach(async () => {
    await cleanup();
    sent = [];
    accept = true;

    await db.insert(schema.user).values([
      { id: PRO, email: `${PRO}@example.com`, name: "Ama Mensah" },
      { id: ULTRA, email: `${ULTRA}@example.com`, name: null },
      { id: FREE, email: `${FREE}@example.com`, name: "Kofi" },
    ]);
    await db.insert(schema.subscription).values([
      { userId: PRO, status: "active", plan: "pro", variantId: 1811616 },
      { userId: ULTRA, status: "active", plan: "ultra", variantId: 1108002 },
    ]);

    const [folderRow] = await db.insert(schema.folder).values({ name: "Clients", userId: PRO });
    const [campaignRow] = await db
      .insert(schema.campaign)
      .values({ name: "Spring", slug: `${PREFIX}spring`, userId: PRO });
    const folderId = folderRow.insertId;
    const campaignId = campaignRow.insertId;

    const shared = await addLink(PRO, "shared", { statsShareToken: SHARE_TOKEN });
    const inFolder = await addLink(PRO, "menu", { name: "Menu", folderId, campaignId });
    await addLink(PRO, "quiet", { folderId });
    const ultraLink = await addLink(ULTRA, "u1");
    const freeLink = await addLink(FREE, "f1");

    // Shared link: the week, the week before, and the first instant after the week (excluded).
    await addVisits(shared, 5, new Date("2026-11-18T12:00:00Z"), {
      country: "Ghana",
      device: "mobile",
      referer: "instagram.com",
    });
    await addVisits(shared, 2, new Date("2026-11-11T12:00:00Z"));
    await addVisits(shared, 1, new Date("2026-11-23T00:00:00Z"));
    await addVisits(inFolder, 4, new Date("2026-11-17T08:00:00Z"), {
      country: "Kenya",
      device: "Desktop",
    });
    await addVisits(inFolder, 6, new Date("2026-10-05T08:00:00Z"));
    // Ultra link: weekly 3 vs 1; monthly October 7 (last instant included) vs September 4.
    await addVisits(ultraLink, 3, new Date("2026-11-20T10:00:00Z"));
    await addVisits(ultraLink, 1, new Date("2026-11-14T10:00:00Z"));
    await addVisits(ultraLink, 6, new Date("2026-10-10T10:00:00Z"), { country: "France" });
    await addVisits(ultraLink, 1, new Date("2026-10-31T23:59:59Z"), { country: "France" });
    await addVisits(ultraLink, 2, new Date("2026-11-01T00:00:00Z"));
    await addVisits(ultraLink, 4, new Date("2026-09-30T10:00:00Z"));
    await addVisits(freeLink, 9, new Date("2026-11-18T12:00:00Z"));

    await addReport("linkWeekly", {
      userId: PRO,
      targetType: "link",
      targetId: shared,
      frequency: "weekly",
      recipients: ["client@example.com", "gone@example.com"],
      unsubscribed: ["gone@example.com"],
    });
    await addReport("folderWeekly", {
      userId: PRO,
      targetType: "folder",
      targetId: folderId,
      frequency: "weekly",
      recipients: ["folder@example.com"],
    });
    await addReport("campaignMonthly", {
      userId: PRO,
      targetType: "campaign",
      targetId: campaignId,
      frequency: "monthly",
      recipients: ["campaign@example.com"],
    });
    // A fourth Pro schedule (left from a downgrade) is past the plan's 3.
    await addReport("overCap", {
      userId: PRO,
      targetType: "link",
      targetId: shared,
      frequency: "monthly",
      recipients: ["over@example.com"],
    });
    await addReport("deletedTarget", {
      userId: PRO,
      targetType: "link",
      targetId: 2_000_000_000,
      frequency: "weekly",
      recipients: ["deleted@example.com"],
    });
    await addReport("ultraWeekly", {
      userId: ULTRA,
      targetType: "link",
      targetId: ultraLink,
      frequency: "weekly",
      recipients: ["weekly@example.com"],
    });
    await addReport("ultraMonthly", {
      userId: ULTRA,
      targetType: "link",
      targetId: ultraLink,
      frequency: "monthly",
      recipients: ["monthly@example.com"],
    });
    await addReport("createdAfter", {
      userId: ULTRA,
      targetType: "link",
      targetId: ultraLink,
      frequency: "weekly",
      recipients: ["new@example.com"],
      createdAt: new Date("2026-11-25T00:00:00Z"),
    });
    await addReport("free", {
      userId: FREE,
      targetType: "link",
      targetId: freeLink,
      frequency: "weekly",
      recipients: ["free@example.com"],
    });
  });

  afterAll(cleanup);

  test("sends each due report to its active recipients only", async () => {
    const result = await run();

    expect(sent.map((item) => item.email).sort()).toEqual(
      [
        "campaign@example.com",
        "client@example.com",
        "folder@example.com",
        "monthly@example.com",
        "weekly@example.com",
      ].sort(),
    );
    expect(result).toMatchObject({ sent: 5, emails: 5, failed: 0, skipped: 3 });
  });

  test("a weekly link report has the week's numbers and the public stats page", async () => {
    await run();
    expect(sentFor("linkWeekly")[0]?.content).toEqual({
      frequency: "weekly",
      periodLabel: "16-22 Nov",
      targetType: "link",
      targetName: `ishortn.ink/${PREFIX}shared`,
      senderName: "Ama Mensah",
      clicks: 5,
      previousClicks: 2,
      topLinks: [],
      countries: [{ name: "Ghana", clicks: 5 }],
      devices: [{ name: "Mobile", clicks: 5 }],
      sources: [{ name: "Instagram", clicks: 5 }],
      statsUrl: `https://ishortn.ink/stats/${SHARE_TOKEN}`,
    });
  });

  test("weekly and monthly link reports count their own periods", async () => {
    await run();
    expect(sentFor("ultraWeekly")[0]?.content).toMatchObject({
      periodLabel: "16-22 Nov",
      clicks: 3,
      previousClicks: 1,
      senderName: `${ULTRA}@example.com`,
      statsUrl: null,
    });
    expect(sentFor("ultraMonthly")[0]?.content).toMatchObject({
      frequency: "monthly",
      periodLabel: "October 2026",
      clicks: 7,
      previousClicks: 4,
      countries: [{ name: "France", clicks: 7 }],
    });
  });

  test("folder and campaign reports total their links and list the top ones", async () => {
    await run();
    expect(sentFor("folderWeekly")[0]?.content).toMatchObject({
      targetType: "folder",
      targetName: "Clients",
      clicks: 4,
      previousClicks: 0,
      topLinks: [{ shortUrl: `ishortn.ink/${PREFIX}menu`, name: "Menu", clicks: 4 }],
      countries: [{ name: "Kenya", clicks: 4 }],
      devices: [{ name: "Desktop", clicks: 4 }],
      sources: [{ name: "Direct", clicks: 4 }],
    });
    expect(sentFor("campaignMonthly")[0]?.content).toMatchObject({
      targetType: "campaign",
      targetName: "Spring",
      periodLabel: "October 2026",
      clicks: 6,
      previousClicks: 0,
    });
  });

  test("re-running the period sends nothing new", async () => {
    await run();
    const second = await run({ now: new Date(NOW.getTime() + 60 * 60 * 1000) });

    expect(sent).toHaveLength(5);
    expect(second).toMatchObject({ due: 0, sent: 0 });
    const [linkWeekly] = await db
      .select()
      .from(schema.scheduledReport)
      .where(eq(schema.scheduledReport.id, ids.linkWeekly!));
    expect(linkWeekly?.lastPeriodKey).toBe("w:2026-11-16");
    expect(linkWeekly?.lastSentAt).not.toBeNull();
  });

  test("a rejected send releases the claim for the next run", async () => {
    accept = false;
    const result = await run({ maxSends: 1 });
    expect(result).toMatchObject({ failed: 1, sent: 0 });

    const rows = await db
      .select({ lastPeriodKey: schema.scheduledReport.lastPeriodKey })
      .from(schema.scheduledReport)
      .where(eq(schema.scheduledReport.id, sent[0]!.reportId));
    expect(rows[0]?.lastPeriodKey).toBeNull();
  });

  test("a dry run previews without claiming or sending", async () => {
    const result = await run({ dryRun: true });

    expect(sent).toEqual([]);
    expect(result.previews.map((item) => item.reportId).sort()).toEqual(
      [ids.linkWeekly, ids.folderWeekly, ids.campaignMonthly, ids.ultraWeekly, ids.ultraMonthly]
        .map(Number)
        .sort(),
    );
    const claimed = await db
      .select({ key: schema.scheduledReport.lastPeriodKey })
      .from(schema.scheduledReport)
      .where(inArray(schema.scheduledReport.userId, USERS));
    expect(claimed.every((row) => row.key === null)).toBe(true);
  });

  test("an unsubscribed recipient is dropped from that report only", async () => {
    await unsubscribeReportRecipient(`${ids.folderWeekly}:folder@example.com`);
    await unsubscribeReportRecipient(`${ids.folderWeekly}:folder@example.com`);
    await unsubscribeReportRecipient("not-a-recipient-id");

    const [row] = await db
      .select({ unsubscribed: schema.scheduledReport.unsubscribed })
      .from(schema.scheduledReport)
      .where(eq(schema.scheduledReport.id, ids.folderWeekly!));
    expect(row?.unsubscribed).toEqual(["folder@example.com"]);

    await run();
    expect(sentFor("folderWeekly")).toEqual([]);
    expect(sentFor("linkWeekly")).toHaveLength(1);
  });
});

describe.skipIf(!testDatabaseUrl)("scheduled reports in a team (MySQL)", () => {
  const PREFIX = "srt_test_";
  const OWNER = `${PREFIX}owner`;
  const ADMIN = `${PREFIX}admin`;
  const MEMBER = `${PREFIX}member`;
  const GRANTED = `${PREFIX}granted`;
  const LEFT = `${PREFIX}left`;
  const USERS = [OWNER, ADMIN, MEMBER, GRANTED, LEFT];

  let sent: SendScheduledReportInput[] = [];
  const run = () =>
    sendScheduledReports({
      now: NOW,
      sendIntervalMs: 0,
      send: async (input) => {
        sent.push(input);
        return true;
      },
    });
  const ids: Record<string, number> = {};
  const clicksFor = (key: string) =>
    sent.find((item) => item.reportId === ids[key])?.content.clicks;

  beforeAll(() => {
    if (!env.DATABASE_URL) Object.assign(env, { DATABASE_URL: testDatabaseUrl });
    if (!env.NEXT_PUBLIC_APP_URL) {
      Object.assign(env, { NEXT_PUBLIC_APP_URL: "https://ishortn.ink" });
    }
  });

  async function cleanup() {
    const teams = await db
      .select({ id: schema.team.id })
      .from(schema.team)
      .where(eq(schema.team.ownerId, OWNER));
    const teamIds = teams.map((row) => row.id);
    const links = await db
      .select({ id: schema.link.id })
      .from(schema.link)
      .where(inArray(schema.link.userId, USERS));
    if (links.length) {
      await db.delete(schema.linkVisit).where(
        inArray(
          schema.linkVisit.linkId,
          links.map((row) => row.id),
        ),
      );
    }
    await db.delete(schema.link).where(inArray(schema.link.userId, USERS));
    await db.delete(schema.folderPermission).where(inArray(schema.folderPermission.userId, USERS));
    await db.delete(schema.folder).where(inArray(schema.folder.userId, USERS));
    await db.delete(schema.campaign).where(inArray(schema.campaign.userId, USERS));
    await db.delete(schema.scheduledReport).where(inArray(schema.scheduledReport.userId, USERS));
    if (teamIds.length) {
      await db.delete(schema.teamMember).where(inArray(schema.teamMember.teamId, teamIds));
      await db.delete(schema.team).where(inArray(schema.team.id, teamIds));
    }
    await db.delete(schema.subscription).where(inArray(schema.subscription.userId, USERS));
    await db.delete(schema.user).where(inArray(schema.user.id, USERS));
  }

  beforeEach(async () => {
    await cleanup();
    sent = [];

    await db
      .insert(schema.user)
      .values(USERS.map((id) => ({ id, email: `${id}@example.com`, name: id })));
    await db
      .insert(schema.subscription)
      .values({ userId: OWNER, status: "active", plan: "ultra", variantId: 1108002 });
    const [teamRow] = await db
      .insert(schema.team)
      .values({ name: "Agency", slug: `${PREFIX}agency`, ownerId: OWNER });
    const teamId = teamRow.insertId;
    await db.insert(schema.teamMember).values([
      { teamId, userId: OWNER, role: "owner" },
      { teamId, userId: ADMIN, role: "admin" },
      { teamId, userId: MEMBER, role: "member" },
      { teamId, userId: GRANTED, role: "member" },
    ]);

    const [openRow] = await db
      .insert(schema.folder)
      .values({ name: "Open", userId: OWNER, teamId });
    const [secretRow] = await db
      .insert(schema.folder)
      .values({ name: "Secret", userId: OWNER, teamId, isRestricted: true });
    const secretId = secretRow.insertId;
    // LEFT was granted the folder, then left the team: the grant no longer counts.
    await db.insert(schema.folderPermission).values([
      { folderId: secretId, userId: GRANTED },
      { folderId: secretId, userId: LEFT },
    ]);
    const [campaignRow] = await db
      .insert(schema.campaign)
      .values({ name: "Launch", slug: `${PREFIX}launch`, userId: OWNER, teamId });
    const campaignId = campaignRow.insertId;

    const addLink = async (alias: string, extra: Partial<typeof schema.link.$inferInsert>) => {
      const [result] = await db.insert(schema.link).values({
        url: "https://example.com",
        alias: `${PREFIX}${alias}`,
        userId: OWNER,
        teamId,
        campaignId,
        ...extra,
      });
      return result.insertId;
    };
    const visits = (linkId: number, total: number) =>
      db.insert(schema.linkVisit).values(
        Array.from({ length: total }, () => ({
          linkId,
          createdAt: new Date("2026-11-18T12:00:00Z"),
        })),
      );
    await visits(await addLink("open", { folderId: openRow.insertId }), 2);
    const secretLink = await addLink("secret", { folderId: secretId });
    await visits(secretLink, 3);
    await visits(await addLink("loose", {}), 1);
    await visits(await addLink("bio", { isBioLink: true }), 5);

    const addReport = async (
      key: string,
      createdBy: string | null,
      target: Pick<typeof schema.scheduledReport.$inferInsert, "targetType" | "targetId">,
    ) => {
      const [result] = await db.insert(schema.scheduledReport).values({
        userId: createdBy ?? OWNER,
        teamId,
        createdBy,
        frequency: "weekly",
        recipients: [`${key}@example.com`],
        createdAt: CREATED,
        ...target,
      });
      ids[key] = result.insertId;
    };
    const onCampaign = { targetType: "campaign", targetId: campaignId } as const;
    await addReport("byMember", MEMBER, onCampaign);
    await addReport("byGranted", GRANTED, onCampaign);
    await addReport("byAdmin", ADMIN, onCampaign);
    await addReport("byOwner", OWNER, onCampaign);
    await addReport("byLeft", LEFT, onCampaign);
    await addReport("byUnknown", null, onCampaign);
    await addReport("secretByMember", MEMBER, { targetType: "folder", targetId: secretId });
    await addReport("secretByGranted", GRANTED, { targetType: "folder", targetId: secretId });
    await addReport("secretLinkByMember", MEMBER, { targetType: "link", targetId: secretLink });
  });

  afterAll(cleanup);

  test("campaign reports never include bio links", async () => {
    await run();
    // open 2 + secret 3 + loose 1; the bio link's 5 clicks are left out.
    expect(clicksFor("byOwner")).toBe(6);
    expect(
      sent
        .find((item) => item.reportId === ids.byOwner)
        ?.content.topLinks.map((row) => row.shortUrl),
    ).not.toContain(`ishortn.ink/${PREFIX}bio`);
  });

  test("a member's report leaves out restricted folders they can't see", async () => {
    await run();
    expect(clicksFor("byMember")).toBe(3);
    expect(clicksFor("byLeft")).toBe(3);
    expect(clicksFor("byUnknown")).toBe(3);
    expect(clicksFor("byGranted")).toBe(6);
    expect(clicksFor("secretByGranted")).toBe(3);
    expect(sent.some((item) => item.reportId === ids.secretByMember)).toBe(false);
    expect(sent.some((item) => item.reportId === ids.secretLinkByMember)).toBe(false);
  });

  test("an admin's report covers every folder", async () => {
    await run();
    expect(clicksFor("byAdmin")).toBe(6);
  });

  test("unsubscribes arriving together all land", async () => {
    const recipients = ["a@example.com", "b@example.com", "c@example.com", "d@example.com"];
    await db
      .update(schema.scheduledReport)
      .set({ recipients })
      .where(eq(schema.scheduledReport.id, ids.byOwner!));

    await Promise.all(
      [...recipients, "a@example.com"].map((email) =>
        unsubscribeReportRecipient(`${ids.byOwner}:${email}`),
      ),
    );

    const [row] = await db
      .select({ unsubscribed: schema.scheduledReport.unsubscribed })
      .from(schema.scheduledReport)
      .where(eq(schema.scheduledReport.id, ids.byOwner!));
    expect([...(row?.unsubscribed ?? [])].sort()).toEqual(recipients);
  });
});
