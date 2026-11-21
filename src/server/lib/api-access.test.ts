import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import crypto from "node:crypto";

import { eq, inArray } from "drizzle-orm";

import { env } from "@/env.mjs";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";

import {
  clearApiSunsetCache,
  dueApiSunsetEmail,
  ensureApiSunset,
  getApiSunset,
  sendApiSunsetEmailsDue,
} from "./api-access";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const SUNSET = new Date("2026-11-27T12:00:00Z");
const NONE = { notice: null, reminder: null };

describe("dueApiSunsetEmail", () => {
  test("the notice is due until 24 hours before the sunset", () => {
    expect(dueApiSunsetEmail(SUNSET, new Date(SUNSET.getTime() - 7 * DAY), NONE)).toBe("notice");
    expect(dueApiSunsetEmail(SUNSET, new Date(SUNSET.getTime() - DAY - 1), NONE)).toBe("notice");
  });

  test("the reminder is due in the last 24 hours", () => {
    expect(dueApiSunsetEmail(SUNSET, new Date(SUNSET.getTime() - DAY), NONE)).toBe("reminder");
    expect(dueApiSunsetEmail(SUNSET, new Date(SUNSET.getTime() - 1), NONE)).toBe("reminder");
  });

  test("each email is sent once", () => {
    const sent = new Date(SUNSET.getTime() - 7 * DAY);
    expect(
      dueApiSunsetEmail(SUNSET, new Date(SUNSET.getTime() - 3 * DAY), {
        notice: sent,
        reminder: null,
      }),
    ).toBeNull();
    expect(
      dueApiSunsetEmail(SUNSET, new Date(SUNSET.getTime() - HOUR), {
        notice: sent,
        reminder: sent,
      }),
    ).toBeNull();
  });

  test("nothing is due from the sunset on", () => {
    expect(dueApiSunsetEmail(SUNSET, SUNSET, NONE)).toBeNull();
    expect(dueApiSunsetEmail(SUNSET, new Date(SUNSET.getTime() + HOUR), NONE)).toBeNull();
  });
});

// Runs against a disposable MySQL with the schema pushed; see CONTRIBUTING.md,
// "Database tests". Skipped when RESEND_API_KEY is set so it never sends email.
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl || !!process.env.RESEND_API_KEY)(
  "API access sunset (MySQL)",
  () => {
    const PAID = "api_sunset_paid";
    const FREE = "api_sunset_free";
    const EXPIRED = "api_sunset_expired";
    const USERS = [PAID, FREE, EXPIRED];
    const DEPLOY = new Date("2026-11-21T09:00:00Z");
    const originalSunset = env.API_FREE_ACCESS_SUNSET_AT;

    beforeAll(() => {
      if (!env.DATABASE_URL) Object.assign(env, { DATABASE_URL: testDatabaseUrl });
      Object.assign(env, { API_FREE_ACCESS_SUNSET_AT: undefined });
    });

    async function cleanup() {
      await db.delete(schema.apiAccessSunset);
      await db
        .delete(schema.emailSuppression)
        .where(eq(schema.emailSuppression.email, "free@api-sunset.test"));
      await db.delete(schema.token).where(inArray(schema.token.userId, USERS));
      await db.delete(schema.subscription).where(inArray(schema.subscription.userId, USERS));
      await db.delete(schema.user).where(inArray(schema.user.id, USERS));
      clearApiSunsetCache();
    }

    beforeEach(async () => {
      await cleanup();
      await db.insert(schema.user).values([
        { id: PAID, email: "paid@api-sunset.test" },
        { id: FREE, email: "free@api-sunset.test" },
        { id: EXPIRED, email: "expired@api-sunset.test" },
      ]);
      await db.insert(schema.subscription).values(
        [PAID, EXPIRED].map((userId, i) => ({
          userId,
          subscriptionId: i + 1,
          status: "active",
          plan: "pro" as const,
          variantId: 1811616,
        })),
      );
      await db.insert(schema.token).values(
        USERS.map((userId) => ({
          userId,
          token: crypto.createHash("sha256").update(userId).digest("hex"),
        })),
      );
    });

    afterAll(async () => {
      Object.assign(env, { API_FREE_ACCESS_SUNSET_AT: originalSunset });
      await cleanup();
    });

    // What the webhook writes on subscription_expired.
    async function expire(at: Date) {
      await db
        .update(schema.subscription)
        .set({ status: "expired", plan: "free", variantId: 0, productId: 0, endsAt: at })
        .where(eq(schema.subscription.userId, EXPIRED));
    }

    async function sentAt(userId: string) {
      const row = await db.query.user.findFirst({ where: eq(schema.user.id, userId) });
      return {
        notice: row?.apiSunsetNoticeSentAt ?? null,
        reminder: row?.apiSunsetReminderSentAt ?? null,
      };
    }

    test("the cutoff is unset until the first cron run", async () => {
      expect(await getApiSunset()).toBeNull();
    });

    test("the first run stores deploy + 7 days and later runs never move it", async () => {
      const first = await ensureApiSunset(DEPLOY);
      expect(first).toEqual(new Date(DEPLOY.getTime() + 7 * DAY));

      expect(await ensureApiSunset(new Date(DEPLOY.getTime() + 3 * DAY))).toEqual(first);
      clearApiSunsetCache();
      expect(await getApiSunset()).toEqual(first);
    });

    test("the cron's first run stores the cutoff and is the notice run", async () => {
      // No email client in tests, so nothing is accepted and nobody is marked.
      const result = await sendApiSunsetEmailsDue(DEPLOY);

      expect(result).toEqual({
        sunsetAt: new Date(DEPLOY.getTime() + 7 * DAY),
        notice: 0,
        reminder: 0,
        failed: 1,
        closed: 0,
      });
      expect(await sentAt(FREE)).toEqual({ notice: null, reminder: null });
      expect(await sentAt(PAID)).toEqual({ notice: null, reminder: null });
    });

    test("a hard-bounced address isn't emailed", async () => {
      await db.insert(schema.emailSuppression).values({
        email: "free@api-sunset.test",
        type: "bounced",
        userId: FREE,
        lastEventAt: DEPLOY,
      });

      const result = await sendApiSunsetEmailsDue(DEPLOY);

      expect(result).toMatchObject({ notice: 0, failed: 0, closed: 0 });
    });

    test("accounts past their cutoff are closed without an email", async () => {
      await ensureApiSunset(DEPLOY);
      await expire(new Date(DEPLOY.getTime() + 5 * DAY));
      const after = new Date(DEPLOY.getTime() + 8 * DAY);

      const result = await sendApiSunsetEmailsDue(after);

      // FREE is past the cutoff; EXPIRED lapsed after it and is still in its 7 days.
      expect(result).toMatchObject({ closed: 1, failed: 1 });
      expect((await sentAt(FREE)).notice).toEqual(after);
      expect((await sentAt(EXPIRED)).notice).toBeNull();
      expect(await sentAt(PAID)).toEqual({ notice: null, reminder: null });
    });

    test("an account that expired after the cutoff is still emailed before its own", async () => {
      await ensureApiSunset(DEPLOY);
      await expire(new Date(DEPLOY.getTime() + 10 * DAY));
      const lapsedSunset = DEPLOY.getTime() + 17 * DAY;

      const result = await sendApiSunsetEmailsDue(new Date(lapsedSunset - 2 * HOUR));

      expect(result).toMatchObject({ closed: 1, failed: 1 });
    });
  },
);
