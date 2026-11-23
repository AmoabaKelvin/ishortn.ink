import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { inArray } from "drizzle-orm";

import { env } from "@/env.mjs";
import { ACTIVE_PROMO } from "@/lib/billing/promo";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";

import {
  isPromoNoticeDue,
  promoNoticeTarget,
  sendPromoPausedNotices,
  type PromoNoticeCandidate,
} from "./promo-paused-notice";

import type { SendPromoPausedNoticeInput } from "./notifications/promo-paused-notice";

const NOW = new Date("2026-11-25T00:10:00Z");
const PAUSED_AT = new Date("2026-11-20T08:00:00Z");

const due: PromoNoticeCandidate = {
  email: "paused@example.com",
  plan: "free",
  subscriptionMode: "checkout",
  banned: false,
  restrictedAt: null,
  deletedAt: null,
  productEmailsEnabled: true,
  emailSuppressed: false,
  droppedEventCount: 312,
  eventTrackingPausedAt: PAUSED_AT,
  promoNoticeSentFor: null,
};

describe("isPromoNoticeDue", () => {
  test("a Free account paused this month with dropped visits is due", () => {
    expect(isPromoNoticeDue(due, ACTIVE_PROMO, NOW)).toBe(true);
    expect(isPromoNoticeDue({ ...due, banned: null }, ACTIVE_PROMO, NOW)).toBe(true);
    expect(isPromoNoticeDue({ ...due, promoNoticeSentFor: "SPRING10" }, ACTIVE_PROMO, NOW)).toBe(
      true,
    );
  });

  test("a pause from an earlier month or with nothing dropped is not due", () => {
    const october = new Date("2026-10-31T23:59:59Z");
    expect(isPromoNoticeDue({ ...due, eventTrackingPausedAt: october }, ACTIVE_PROMO, NOW)).toBe(
      false,
    );
    expect(isPromoNoticeDue({ ...due, eventTrackingPausedAt: null }, ACTIVE_PROMO, NOW)).toBe(
      false,
    );
    expect(isPromoNoticeDue({ ...due, droppedEventCount: 0 }, ACTIVE_PROMO, NOW)).toBe(false);
    expect(isPromoNoticeDue({ ...due, droppedEventCount: null }, ACTIVE_PROMO, NOW)).toBe(false);
  });

  test("paid accounts and upgrades that aren't a new checkout are not due", () => {
    expect(isPromoNoticeDue({ ...due, plan: "pro" }, ACTIVE_PROMO, NOW)).toBe(false);
    expect(isPromoNoticeDue({ ...due, subscriptionMode: "resume" }, ACTIVE_PROMO, NOW)).toBe(false);
  });

  test("banned, restricted, deleted, opted-out, suppressed and address-less accounts are not due", () => {
    const at = new Date("2026-11-21T00:00:00Z");
    expect(isPromoNoticeDue({ ...due, banned: true }, ACTIVE_PROMO, NOW)).toBe(false);
    expect(isPromoNoticeDue({ ...due, restrictedAt: at }, ACTIVE_PROMO, NOW)).toBe(false);
    expect(isPromoNoticeDue({ ...due, deletedAt: at }, ACTIVE_PROMO, NOW)).toBe(false);
    expect(isPromoNoticeDue({ ...due, productEmailsEnabled: false }, ACTIVE_PROMO, NOW)).toBe(
      false,
    );
    expect(isPromoNoticeDue({ ...due, emailSuppressed: true }, ACTIVE_PROMO, NOW)).toBe(false);
    expect(isPromoNoticeDue({ ...due, email: null }, ACTIVE_PROMO, NOW)).toBe(false);
  });

  test("an account already sent the notice for this promo is never due again", () => {
    expect(
      isPromoNoticeDue({ ...due, promoNoticeSentFor: ACTIVE_PROMO.code }, ACTIVE_PROMO, NOW),
    ).toBe(false);
  });
});

describe("promoNoticeTarget", () => {
  test("offers Pro while the Free cap plus dropped visits fits in Pro's allowance", () => {
    expect(promoNoticeTarget(1)).toBe("pro");
    expect(promoNoticeTarget(9_000)).toBe("pro");
  });

  test("offers Ultra once the month's traffic is over Pro's allowance", () => {
    expect(promoNoticeTarget(9_001)).toBe("ultra");
    expect(promoNoticeTarget(48_000)).toBe("ultra");
  });
});

// Runs against a disposable MySQL with the schema pushed; see CONTRIBUTING.md, "Database tests".
// Sends go through a recorder, so no email leaves the test.
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("promo paused notice job (MySQL)", () => {
  const PREFIX = "ppn_test_";
  const PAUSED = `${PREFIX}paused`;
  const HEAVY = `${PREFIX}heavy`;
  const PRO = `${PREFIX}pro`;
  const LAST_MONTH = `${PREFIX}last_month`;
  const NOT_DROPPED = `${PREFIX}not_dropped`;
  const BANNED = `${PREFIX}banned`;
  const RESTRICTED = `${PREFIX}restricted`;
  const DELETED = `${PREFIX}deleted`;
  const OPTED_OUT = `${PREFIX}opted_out`;
  const BOUNCED = `${PREFIX}bounced`;
  const ALREADY_SENT = `${PREFIX}already_sent`;
  const USERS = [
    PAUSED,
    HEAVY,
    PRO,
    LAST_MONTH,
    NOT_DROPPED,
    BANNED,
    RESTRICTED,
    DELETED,
    OPTED_OUT,
    BOUNCED,
    ALREADY_SENT,
  ];
  const emailOf = (id: string) => `${id}@promo-paused-notice.test`;

  let sent: SendPromoPausedNoticeInput[] = [];
  const record = async (input: SendPromoPausedNoticeInput) => {
    sent.push(input);
    return true;
  };

  beforeAll(() => {
    if (!env.DATABASE_URL) Object.assign(env, { DATABASE_URL: testDatabaseUrl });
  });

  async function cleanup() {
    await db.delete(schema.emailSuppression).where(inArray(schema.emailSuppression.userId, USERS));
    await db.delete(schema.subscription).where(inArray(schema.subscription.userId, USERS));
    await db.delete(schema.user).where(inArray(schema.user.id, USERS));
  }

  beforeEach(async () => {
    await cleanup();
    sent = [];
    const row = (id: string, droppedEventCount = 312) => ({
      id,
      email: emailOf(id),
      monthlyEventCount: 1000,
      droppedEventCount,
      eventTrackingPausedAt: PAUSED_AT,
    });
    await db
      .insert(schema.user)
      .values([
        row(PAUSED),
        row(HEAVY, 12_000),
        row(PRO),
        { ...row(LAST_MONTH), eventTrackingPausedAt: new Date("2026-10-20T08:00:00Z") },
        row(NOT_DROPPED, 0),
        { ...row(BANNED), banned: true },
        { ...row(RESTRICTED), restrictedAt: PAUSED_AT },
        { ...row(DELETED), deletedAt: PAUSED_AT },
        { ...row(OPTED_OUT), productEmailsEnabled: false },
        row(BOUNCED),
        { ...row(ALREADY_SENT), promoNoticeSentFor: ACTIVE_PROMO.code },
      ]);
    await db.insert(schema.subscription).values({
      userId: PRO,
      subscriptionId: 42,
      status: "active",
      plan: "pro",
    });
    await db.insert(schema.emailSuppression).values({
      email: emailOf(BOUNCED),
      type: "bounced",
      userId: BOUNCED,
      lastEventAt: PAUSED_AT,
    });
  });

  afterAll(cleanup);

  const ids = () => sent.map((s) => s.userId).sort();

  test("only matching accounts are emailed, once across consecutive runs", async () => {
    const first = await sendPromoPausedNotices({ now: NOW, send: record });
    const second = await sendPromoPausedNotices({
      now: new Date(NOW.getTime() + 60 * 60 * 1000),
      send: record,
    });

    expect(ids()).toEqual([HEAVY, PAUSED].sort());
    expect(first).toMatchObject({ sent: 2, failed: 0 });
    expect(second).toMatchObject({ sent: 0, failed: 0 });

    const paused = sent.find((s) => s.userId === PAUSED);
    expect(paused).toMatchObject({ dropped: 312, target: "pro", promo: ACTIVE_PROMO });
    expect(paused?.pausedAt.toISOString()).toBe(PAUSED_AT.toISOString());
    expect(sent.find((s) => s.userId === HEAVY)?.target).toBe("ultra");

    const marked = await db
      .select({ id: schema.user.id, code: schema.user.promoNoticeSentFor })
      .from(schema.user)
      .where(inArray(schema.user.id, [PAUSED, HEAVY, PRO]));
    expect(Object.fromEntries(marked.map((m) => [m.id, m.code]))).toEqual({
      [PAUSED]: ACTIVE_PROMO.code,
      [HEAVY]: ACTIVE_PROMO.code,
      [PRO]: null,
    });
  });

  test("an account that pauses later in the promo gets the notice on the next run", async () => {
    await db
      .update(schema.user)
      .set({ droppedEventCount: 0 })
      .where(inArray(schema.user.id, [HEAVY]));
    await sendPromoPausedNotices({ now: NOW, send: record });
    await db
      .update(schema.user)
      .set({ droppedEventCount: 5 })
      .where(inArray(schema.user.id, [HEAVY]));
    await sendPromoPausedNotices({ now: NOW, send: record });

    expect(sent.map((s) => s.userId)).toEqual([PAUSED, HEAVY]);
  });

  test("a rejected send is retried on the next run", async () => {
    const reject = async (input: SendPromoPausedNoticeInput) => {
      sent.push(input);
      return false;
    };

    expect(await sendPromoPausedNotices({ now: NOW, send: reject })).toMatchObject({
      sent: 0,
      failed: 2,
    });
    expect(await sendPromoPausedNotices({ now: NOW, send: record })).toMatchObject({
      sent: 2,
      failed: 0,
    });
    expect(await sendPromoPausedNotices({ now: NOW, send: record })).toMatchObject({ sent: 0 });
  });

  test("a run stops at the send cap and the next run picks up the rest", async () => {
    expect(await sendPromoPausedNotices({ now: NOW, send: record, maxSends: 1 })).toMatchObject({
      sent: 1,
    });
    expect(await sendPromoPausedNotices({ now: NOW, send: record, maxSends: 1 })).toMatchObject({
      sent: 1,
    });
    expect(ids()).toEqual([HEAVY, PAUSED].sort());
  });

  test("does nothing outside the promo window", async () => {
    for (const now of [new Date("2026-11-24T23:00:00Z"), new Date("2026-12-02T00:10:00Z")]) {
      expect(await sendPromoPausedNotices({ now, send: record })).toMatchObject({
        checked: 0,
        sent: 0,
      });
    }
    expect(sent).toEqual([]);
  });
});
