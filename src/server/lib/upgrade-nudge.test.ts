import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { inArray } from "drizzle-orm";

import { env } from "@/env.mjs";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";

import {
  chooseUpgradeNudgeAngle,
  isUpgradeNudgeDue,
  projectedEventCapDate,
  sendUpgradeNudges,
  type UpgradeNudgeCandidate,
  type UpgradeNudgeUsage,
} from "./upgrade-nudge";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-11-21T12:00:00Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY);

const due: UpgradeNudgeCandidate = {
  createdAt: daysAgo(5),
  email: "active@example.com",
  plan: "free",
  banned: false,
  restrictedAt: null,
  deletedAt: null,
  productEmailsEnabled: true,
  emailSuppressed: false,
  eventTrackingPausedAt: null,
  upgradeNudgeSentAt: null,
  lastWeeklySummaryAt: null,
  linkCount: 3,
  clickCount: 0,
  freeLimitHitCount: 0,
};

describe("isUpgradeNudgeDue", () => {
  test("a Free account 4 to 10 days old with 3 links is due", () => {
    expect(isUpgradeNudgeDue(due, NOW)).toBe(true);
    expect(isUpgradeNudgeDue({ ...due, createdAt: daysAgo(4) }, NOW)).toBe(true);
    expect(isUpgradeNudgeDue({ ...due, createdAt: daysAgo(10) }, NOW)).toBe(true);
    expect(isUpgradeNudgeDue({ ...due, banned: null }, NOW)).toBe(true);
  });

  test("accounts outside the 4 to 10 day window are not due", () => {
    expect(isUpgradeNudgeDue({ ...due, createdAt: new Date(daysAgo(4).getTime() + 1) }, NOW)).toBe(
      false,
    );
    expect(isUpgradeNudgeDue({ ...due, createdAt: new Date(daysAgo(10).getTime() - 1) }, NOW)).toBe(
      false,
    );
    expect(isUpgradeNudgeDue({ ...due, createdAt: null }, NOW)).toBe(false);
  });

  test("each intent signal makes an account due on its own", () => {
    const idle = { ...due, linkCount: 2, clickCount: 24, freeLimitHitCount: 0 };
    expect(isUpgradeNudgeDue(idle, NOW)).toBe(false);
    expect(isUpgradeNudgeDue({ ...idle, linkCount: 3 }, NOW)).toBe(true);
    expect(isUpgradeNudgeDue({ ...idle, clickCount: 25 }, NOW)).toBe(true);
    expect(isUpgradeNudgeDue({ ...idle, freeLimitHitCount: 1 }, NOW)).toBe(true);
  });

  test("paid, banned, restricted, deleted, opted-out, suppressed and paused accounts are not due", () => {
    expect(isUpgradeNudgeDue({ ...due, plan: "pro" }, NOW)).toBe(false);
    expect(isUpgradeNudgeDue({ ...due, plan: "ultra" }, NOW)).toBe(false);
    expect(isUpgradeNudgeDue({ ...due, banned: true }, NOW)).toBe(false);
    expect(isUpgradeNudgeDue({ ...due, restrictedAt: daysAgo(1) }, NOW)).toBe(false);
    expect(isUpgradeNudgeDue({ ...due, deletedAt: daysAgo(1) }, NOW)).toBe(false);
    expect(isUpgradeNudgeDue({ ...due, productEmailsEnabled: false }, NOW)).toBe(false);
    expect(isUpgradeNudgeDue({ ...due, emailSuppressed: true }, NOW)).toBe(false);
    expect(isUpgradeNudgeDue({ ...due, eventTrackingPausedAt: daysAgo(1) }, NOW)).toBe(false);
    expect(isUpgradeNudgeDue({ ...due, email: null }, NOW)).toBe(false);
  });

  test("an account that was already nudged is never due again", () => {
    expect(isUpgradeNudgeDue({ ...due, upgradeNudgeSentAt: daysAgo(1) }, NOW)).toBe(false);
  });

  test("an account waits a day after its weekly summary", () => {
    expect(isUpgradeNudgeDue({ ...due, lastWeeklySummaryAt: daysAgo(0.5) }, NOW)).toBe(false);
    expect(isUpgradeNudgeDue({ ...due, lastWeeklySummaryAt: daysAgo(1) }, NOW)).toBe(true);
  });
});

const usage: UpgradeNudgeUsage = {
  createdAt: daysAgo(5),
  monthlyEventCount: 0,
  lastEventCountReset: daysAgo(5),
  monthlyLinkCount: 3,
  lastLinkCountReset: daysAgo(5),
  firstClickAt: null,
  limitHits: [],
};

describe("chooseUpgradeNudgeAngle", () => {
  test("leads with the most recent Pro feature the account tried", () => {
    expect(
      chooseUpgradeNudgeAngle(
        {
          ...usage,
          monthlyEventCount: 900,
          monthlyLinkCount: 20,
          limitHits: [
            { limitKey: "folders", createdAt: daysAgo(3) },
            { limitKey: "domains_page_view", createdAt: new Date("2026-11-19T22:00:00Z") },
          ],
        },
        NOW,
      ),
    ).toEqual({ reason: "limit_hit", feature: "custom domains", hitDate: "19 November" });
  });

  test("a limit key that maps to no Pro feature falls through", () => {
    const angle = chooseUpgradeNudgeAngle(
      {
        ...usage,
        monthlyLinkCount: 15,
        limitHits: [{ limitKey: "bio_link_blocks", createdAt: daysAgo(1) }],
      },
      NOW,
    );
    expect(angle).toEqual({ reason: "links", monthlyLinkCount: 15, resetDate: "1 December" });
  });

  test("events come before links when the cap would be reached before the reset", () => {
    // 600 events over 5 days is 120 a day: 1,000 on day 8.33 after sign-up, 24 November.
    expect(
      chooseUpgradeNudgeAngle({ ...usage, monthlyEventCount: 600, monthlyLinkCount: 20 }, NOW),
    ).toEqual({
      reason: "events",
      monthlyEventCount: 600,
      projectedDate: "24 November",
      resetDate: "1 December",
    });
  });

  test("no events angle under 300 events or when the projection falls after the reset", () => {
    // 299 events in a day would reach 1,000 within the month, but is under the threshold.
    expect(
      chooseUpgradeNudgeAngle({ ...usage, createdAt: daysAgo(1), monthlyEventCount: 299 }, NOW)
        .reason,
    ).toBe("domain");
    // 300 over 4 days is 75 a day: 1,000 on 30 November, inside the month.
    expect(
      chooseUpgradeNudgeAngle({ ...usage, createdAt: daysAgo(4), monthlyEventCount: 300 }, NOW),
    ).toMatchObject({ reason: "events", projectedDate: "30 November" });
    // 300 over 5 days is 60 a day: 1,000 on 3 December, after the 1 December reset.
    expect(chooseUpgradeNudgeAngle({ ...usage, monthlyEventCount: 300 }, NOW).reason).toBe(
      "domain",
    );
  });

  test("links at half the Free allowance, but not counts left from last month", () => {
    expect(chooseUpgradeNudgeAngle({ ...usage, monthlyLinkCount: 14 }, NOW).reason).toBe("domain");
    const dec3 = new Date("2026-12-03T12:00:00Z");
    expect(
      chooseUpgradeNudgeAngle(
        {
          ...usage,
          createdAt: daysAgo(5),
          monthlyLinkCount: 20,
          lastLinkCountReset: daysAgo(5),
          monthlyEventCount: 900,
          lastEventCountReset: daysAgo(5),
        },
        dec3,
      ).reason,
    ).toBe("domain");
  });

  test("analytics: the first clicks' drop-out date, before and after it passes", () => {
    expect(
      chooseUpgradeNudgeAngle({ ...usage, firstClickAt: new Date("2026-11-17T20:00:00Z") }, NOW),
    ).toEqual({
      reason: "analytics",
      firstClickDate: "17 November",
      viewEndDate: "24 November",
      ended: false,
      viewStartDate: "14 November",
    });
    expect(
      chooseUpgradeNudgeAngle({ ...usage, firstClickAt: new Date("2026-11-13T09:00:00Z") }, NOW),
    ).toMatchObject({ reason: "analytics", ended: true, viewStartDate: "14 November" });
  });

  test("the domain angle when nothing else applies", () => {
    expect(chooseUpgradeNudgeAngle(usage, NOW)).toEqual({ reason: "domain" });
  });
});

describe("projectedEventCapDate", () => {
  test("a mid-month sign-up's pace counts from sign-up, not the start of the month", () => {
    // 400 events in the 4 days since sign-up is 100 a day: 1,000 ten days after sign-up.
    const signup = new Date("2026-11-17T12:00:00Z");
    expect(projectedEventCapDate(400, signup, NOW)).toEqual(new Date("2026-11-27T12:00:00Z"));
  });

  test("a sign-up from last month counts from the start of this month", () => {
    // 500 events since 1 December 00:00 (2.5 days) is 200 a day: 1,000 on 6 December.
    const now = new Date("2026-12-03T12:00:00Z");
    expect(projectedEventCapDate(500, new Date("2026-11-27T00:00:00Z"), now)).toEqual(
      new Date("2026-12-06T00:00:00Z"),
    );
  });

  test("null when the cap falls after the monthly reset", () => {
    expect(projectedEventCapDate(300, daysAgo(10), NOW)).toBeNull();
  });
});

// Runs against a disposable MySQL with the schema pushed; see CONTRIBUTING.md, "Database tests".
// Sends go through a recorder, so no email leaves the test.
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("upgrade nudge job (MySQL)", () => {
  const PREFIX = "upn_test_";
  const LINKS = `${PREFIX}links`;
  const LIMIT = `${PREFIX}limit`;
  const IDLE = `${PREFIX}idle`;
  const PAID = `${PREFIX}paid`;
  const SUMMARY = `${PREFIX}summary`;
  const TOO_NEW = `${PREFIX}too_new`;
  const USERS = [LINKS, LIMIT, IDLE, PAID, SUMMARY, TOO_NEW];
  const emailOf = (id: string) => `${id}@upgrade-nudge.test`;

  let sent: Array<{ userId: string; reason: string }> = [];
  const record = async ({
    userId,
    props,
  }: {
    userId: string;
    props: { angle: { reason: string } };
  }) => {
    sent.push({ userId, reason: props.angle.reason });
    return true;
  };

  beforeAll(() => {
    if (!env.DATABASE_URL) Object.assign(env, { DATABASE_URL: testDatabaseUrl });
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
    await db.delete(schema.planLimitHit).where(inArray(schema.planLimitHit.userId, USERS));
    await db
      .delete(schema.weeklySummaryEmail)
      .where(inArray(schema.weeklySummaryEmail.userId, USERS));
    await db.delete(schema.subscription).where(inArray(schema.subscription.userId, USERS));
    await db.delete(schema.user).where(inArray(schema.user.id, USERS));
  }

  beforeEach(async () => {
    await cleanup();
    sent = [];
    const row = (id: string, createdAt = daysAgo(5)) => ({ id, email: emailOf(id), createdAt });
    await db
      .insert(schema.user)
      .values([
        row(LINKS),
        row(LIMIT),
        row(IDLE),
        row(PAID),
        row(SUMMARY),
        row(TOO_NEW, daysAgo(2)),
      ]);
    const threeLinks = (userId: string) =>
      [1, 2, 3].map((n) => ({
        url: "https://example.com",
        alias: `${userId.slice(PREFIX.length)}${n}`,
        userId,
      }));
    await db
      .insert(schema.link)
      .values([
        ...threeLinks(LINKS),
        ...threeLinks(PAID),
        ...threeLinks(SUMMARY),
        ...threeLinks(TOO_NEW),
      ]);
    await db.insert(schema.planLimitHit).values([
      { userId: LIMIT, limitKey: "folders_page_view", plan: "free", day: "2026-11-19" },
      { userId: IDLE, limitKey: "custom_domains", plan: "pro", day: "2026-11-19" },
    ]);
    await db.insert(schema.subscription).values({
      userId: PAID,
      status: "active",
      plan: "pro",
      createdAt: daysAgo(3),
    });
    await db.insert(schema.weeklySummaryEmail).values({
      userId: SUMMARY,
      weekStart: "2026-11-09",
      clicks: 10,
      createdAt: new Date(NOW.getTime() - 2 * 60 * 60 * 1000),
    });
  });

  afterAll(cleanup);

  const nudged = async () =>
    db
      .select({
        id: schema.user.id,
        at: schema.user.upgradeNudgeSentAt,
        reason: schema.user.upgradeNudgeReason,
      })
      .from(schema.user)
      .where(inArray(schema.user.id, USERS));

  test("overlapping runs email each due account once and record the angle", async () => {
    const [first, second] = await Promise.all([
      sendUpgradeNudges({ now: NOW, send: record }),
      sendUpgradeNudges({ now: NOW, send: record }),
    ]);
    const third = await sendUpgradeNudges({ now: NOW, send: record });

    expect([...sent].sort((a, b) => a.userId.localeCompare(b.userId))).toEqual([
      { userId: LIMIT, reason: "limit_hit" },
      { userId: LINKS, reason: "domain" },
    ]);
    expect(first.sent + second.sent).toBe(2);
    expect(third.sent).toBe(0);

    const rows = new Map((await nudged()).map((item) => [item.id, item]));
    expect(rows.get(LIMIT)?.reason).toBe("limit_hit");
    expect(rows.get(LINKS)?.reason).toBe("domain");
    expect(rows.get(LINKS)?.at).not.toBeNull();
    expect(rows.get(PAID)?.at).toBeNull();
    expect(rows.get(SUMMARY)?.at).toBeNull();
  });

  test("the weekly summary account is picked up a day later", async () => {
    await sendUpgradeNudges({ now: NOW, send: record });
    await sendUpgradeNudges({ now: new Date(NOW.getTime() + DAY), send: record });
    expect(sent.map((item) => item.userId)).toContain(SUMMARY);
  });

  test("a rejected send clears both columns and is retried", async () => {
    const reject = async () => false;

    expect(await sendUpgradeNudges({ now: NOW, send: reject })).toMatchObject({
      sent: 0,
      failed: 2,
    });
    for (const row of await nudged()) {
      expect(row.at).toBeNull();
      expect(row.reason).toBeNull();
    }
    expect(await sendUpgradeNudges({ now: NOW, send: record })).toMatchObject({ sent: 2 });
  });

  test("a dry run returns the recipients and props without claiming or sending", async () => {
    const result = await sendUpgradeNudges({ now: NOW, send: record, dryRun: true });

    expect(sent).toEqual([]);
    expect(result.sent).toBe(0);
    expect(result.byReason).toEqual({ limit_hit: 1, domain: 1 });
    expect(result.previews.map((item) => item.userId).sort()).toEqual([LIMIT, LINKS].sort());
    const limit = result.previews.find((item) => item.userId === LIMIT);
    expect(limit?.props.angle).toMatchObject({ reason: "limit_hit", feature: "folders" });
    expect(limit?.props.upgradeUrl).toContain("utm_content=limit_hit");
    for (const row of await nudged()) expect(row.at).toBeNull();
  });
});
