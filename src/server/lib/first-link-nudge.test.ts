import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { inArray } from "drizzle-orm";

import { env } from "@/env.mjs";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";

import {
  isFirstLinkNudgeDue,
  sendFirstLinkNudges,
  type FirstLinkNudgeCandidate,
} from "./first-link-nudge";

const HOUR = 60 * 60 * 1000;
const NOW = new Date("2026-11-21T12:00:00Z");
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * HOUR);

const due: FirstLinkNudgeCandidate = {
  createdAt: hoursAgo(25),
  email: "new@example.com",
  banned: false,
  deletedAt: null,
  productEmailsEnabled: true,
  firstLinkNudgeSentAt: null,
  hasLink: false,
  emailSuppressed: false,
};

describe("isFirstLinkNudgeDue", () => {
  test("an account 24 to 72 hours old with no links is due", () => {
    expect(isFirstLinkNudgeDue(due, NOW)).toBe(true);
    expect(isFirstLinkNudgeDue({ ...due, createdAt: hoursAgo(24) }, NOW)).toBe(true);
    expect(isFirstLinkNudgeDue({ ...due, createdAt: hoursAgo(72) }, NOW)).toBe(true);
    expect(isFirstLinkNudgeDue({ ...due, banned: null }, NOW)).toBe(true);
  });

  test("accounts outside the window are not due", () => {
    expect(isFirstLinkNudgeDue({ ...due, createdAt: hoursAgo(10) }, NOW)).toBe(false);
    expect(
      isFirstLinkNudgeDue({ ...due, createdAt: new Date(hoursAgo(24).getTime() + 1) }, NOW),
    ).toBe(false);
    expect(
      isFirstLinkNudgeDue({ ...due, createdAt: new Date(hoursAgo(72).getTime() - 1) }, NOW),
    ).toBe(false);
    expect(isFirstLinkNudgeDue({ ...due, createdAt: null }, NOW)).toBe(false);
  });

  test("accounts with a link are not due", () => {
    expect(isFirstLinkNudgeDue({ ...due, hasLink: true }, NOW)).toBe(false);
  });

  test("banned, deleted, opted-out, suppressed and address-less accounts are not due", () => {
    expect(isFirstLinkNudgeDue({ ...due, banned: true }, NOW)).toBe(false);
    expect(isFirstLinkNudgeDue({ ...due, deletedAt: hoursAgo(1) }, NOW)).toBe(false);
    expect(isFirstLinkNudgeDue({ ...due, productEmailsEnabled: false }, NOW)).toBe(false);
    expect(isFirstLinkNudgeDue({ ...due, emailSuppressed: true }, NOW)).toBe(false);
    expect(isFirstLinkNudgeDue({ ...due, email: null }, NOW)).toBe(false);
  });

  test("an account that was already nudged is never due again", () => {
    expect(isFirstLinkNudgeDue({ ...due, firstLinkNudgeSentAt: hoursAgo(1) }, NOW)).toBe(false);
  });
});

// Runs against a disposable MySQL with the schema pushed; see CONTRIBUTING.md, "Database tests".
// Sends go through a recorder, so no email leaves the test.
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("first link nudge job (MySQL)", () => {
  const PREFIX = "fln_test_";
  const NEW = `${PREFIX}new`;
  const TEAM_LINK = `${PREFIX}team_link`;
  const PERSONAL_LINK = `${PREFIX}personal_link`;
  const BANNED = `${PREFIX}banned`;
  const OPTED_OUT = `${PREFIX}opted_out`;
  const BOUNCED = `${PREFIX}bounced`;
  const TOO_NEW = `${PREFIX}too_new`;
  const TOO_OLD = `${PREFIX}too_old`;
  const USERS = [NEW, TEAM_LINK, PERSONAL_LINK, BANNED, OPTED_OUT, BOUNCED, TOO_NEW, TOO_OLD];
  const emailOf = (id: string) => `${id}@first-link-nudge.test`;

  let sent: string[] = [];
  const record = async ({ userId }: { userId: string }) => {
    sent.push(userId);
    return true;
  };

  beforeAll(() => {
    if (!env.DATABASE_URL) Object.assign(env, { DATABASE_URL: testDatabaseUrl });
  });

  async function cleanup() {
    await db.delete(schema.emailSuppression).where(inArray(schema.emailSuppression.userId, USERS));
    await db.delete(schema.link).where(inArray(schema.link.userId, USERS));
    await db.delete(schema.user).where(inArray(schema.user.id, USERS));
  }

  beforeEach(async () => {
    await cleanup();
    sent = [];
    const row = (id: string, createdAt = hoursAgo(25)) => ({ id, email: emailOf(id), createdAt });
    await db
      .insert(schema.user)
      .values([
        row(NEW),
        row(TEAM_LINK),
        row(PERSONAL_LINK),
        { ...row(BANNED), banned: true },
        { ...row(OPTED_OUT), productEmailsEnabled: false },
        row(BOUNCED),
        row(TOO_NEW, hoursAgo(10)),
        row(TOO_OLD, hoursAgo(80)),
      ]);
    await db.insert(schema.link).values([
      { url: "https://example.com", alias: `${PREFIX}p`, userId: PERSONAL_LINK, teamId: null },
      { url: "https://example.com", alias: `${PREFIX}t`, userId: TEAM_LINK, teamId: 999_999 },
    ]);
    await db.insert(schema.emailSuppression).values({
      email: emailOf(BOUNCED),
      type: "bounced",
      userId: BOUNCED,
      lastEventAt: hoursAgo(2),
    });
  });

  afterAll(cleanup);

  test("only the due account is emailed, once across consecutive runs", async () => {
    const first = await sendFirstLinkNudges({ now: NOW, send: record });
    const second = await sendFirstLinkNudges({ now: new Date(NOW.getTime() + HOUR), send: record });

    expect(sent).toEqual([NEW]);
    expect(first).toMatchObject({ sent: 1, failed: 0 });
    expect(second).toMatchObject({ sent: 0, failed: 0 });

    const [nudged] = await db
      .select({ at: schema.user.firstLinkNudgeSentAt })
      .from(schema.user)
      .where(inArray(schema.user.id, [NEW]));
    expect(nudged?.at).not.toBeNull();
  });

  test("a rejected send is retried on the next run", async () => {
    const reject = async ({ userId }: { userId: string }) => {
      sent.push(userId);
      return false;
    };

    expect(await sendFirstLinkNudges({ now: NOW, send: reject })).toMatchObject({
      sent: 0,
      failed: 1,
    });
    expect(await sendFirstLinkNudges({ now: NOW, send: record })).toMatchObject({
      sent: 1,
      failed: 0,
    });
    expect(await sendFirstLinkNudges({ now: NOW, send: record })).toMatchObject({ sent: 0 });
    expect(sent).toEqual([NEW, NEW]);
  });

  test("a run stops at the send cap and the next run picks up the rest", async () => {
    await db
      .update(schema.user)
      .set({ banned: false })
      .where(inArray(schema.user.id, [BANNED]));

    expect(await sendFirstLinkNudges({ now: NOW, send: record, maxSends: 1 })).toMatchObject({
      sent: 1,
    });
    expect(await sendFirstLinkNudges({ now: NOW, send: record, maxSends: 1 })).toMatchObject({
      sent: 1,
    });
    expect(await sendFirstLinkNudges({ now: NOW, send: record, maxSends: 1 })).toMatchObject({
      sent: 0,
    });
    expect([...sent].sort()).toEqual([BANNED, NEW].sort());
  });
});
