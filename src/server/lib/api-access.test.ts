import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import crypto from "node:crypto";

import { and, eq, inArray, not } from "drizzle-orm";

import { env } from "@/env.mjs";
import { API_FREE_ACCESS_SUNSET_AT } from "@/lib/billing/api-access";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";

import {
  apiSunsetEmailFor,
  dueApiSunsetEmail,
  paidSubscription,
  sendApiSunsetEmailsDue,
} from "./api-access";

import type { ApiAccess } from "@/lib/billing/api-access";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const SUNSET = new Date("2026-11-27T12:00:00Z");

describe("dueApiSunsetEmail", () => {
  test("the notice is due until 24 hours before the sunset", () => {
    expect(dueApiSunsetEmail(SUNSET, new Date(SUNSET.getTime() - 7 * 24 * HOUR))).toBe("notice");
    expect(dueApiSunsetEmail(SUNSET, new Date(SUNSET.getTime() - 24 * HOUR - 1))).toBe("notice");
  });

  test("the reminder is due in the last 24 hours", () => {
    expect(dueApiSunsetEmail(SUNSET, new Date(SUNSET.getTime() - 24 * HOUR))).toBe("reminder");
    expect(dueApiSunsetEmail(SUNSET, new Date(SUNSET.getTime() - 1))).toBe("reminder");
  });

  test("nothing is due from the sunset on", () => {
    expect(dueApiSunsetEmail(SUNSET, SUNSET)).toBeNull();
    expect(dueApiSunsetEmail(SUNSET, new Date(SUNSET.getTime() + HOUR))).toBeNull();
  });
});

describe("apiSunsetEmailFor", () => {
  // A plan that lapsed on day 5 of the configured notice period: cut off 7 days later.
  const lapse = new Date(SUNSET.getTime() - 2 * DAY);
  const lapsed: ApiAccess = {
    status: "sunsetting",
    deprecatedAt: lapse,
    sunsetAt: new Date(lapse.getTime() + 7 * DAY),
  };
  const nothingSent = { noticeSentAt: null, reminderSentAt: null };

  test("uses the account's own cutoff, not the configured one", () => {
    // 24 hours before the configured cutoff is still 6 days before this account's.
    expect(apiSunsetEmailFor(lapsed, nothingSent, new Date(SUNSET.getTime() - HOUR))).toBe(
      "notice",
    );
    const noticed = { noticeSentAt: lapse, reminderSentAt: null };
    expect(apiSunsetEmailFor(lapsed, noticed, new Date(SUNSET.getTime() - HOUR))).toBeNull();
    expect(
      apiSunsetEmailFor(lapsed, noticed, new Date(lapsed.sunsetAt.getTime() - 24 * HOUR)),
    ).toBe("reminder");
  });

  test("an account that enters its last 24 hours unnotified gets only the reminder", () => {
    const now = new Date(lapsed.sunsetAt.getTime() - HOUR);
    expect(apiSunsetEmailFor(lapsed, nothingSent, now)).toBe("reminder");
    expect(apiSunsetEmailFor(lapsed, { noticeSentAt: now, reminderSentAt: now }, now)).toBeNull();
  });

  test("a notice sent more than 7 days before the cutoff still counts", () => {
    const configured: ApiAccess = {
      status: "sunsetting",
      deprecatedAt: new Date(SUNSET.getTime() - 7 * DAY),
      sunsetAt: SUNSET,
    };
    const noticedAtRelease = {
      noticeSentAt: new Date(SUNSET.getTime() - 8 * DAY),
      reminderSentAt: null,
    };
    expect(
      apiSunsetEmailFor(configured, noticedAtRelease, new Date(SUNSET.getTime() - 7 * DAY - HOUR)),
    ).toBeNull();
  });

  test("emails from an earlier sunset period don't count", () => {
    const earlier = new Date(lapse.getTime() - 30 * DAY);
    const sent = { noticeSentAt: earlier, reminderSentAt: earlier };
    expect(apiSunsetEmailFor(lapsed, sent, lapse)).toBe("notice");
  });

  test("nothing is due for full or revoked access", () => {
    expect(apiSunsetEmailFor({ status: "full" }, nothingSent, SUNSET)).toBeNull();
    expect(
      apiSunsetEmailFor({ status: "revoked", sunsetAt: SUNSET }, nothingSent, SUNSET),
    ).toBeNull();
  });
});

// Runs against a disposable MySQL with the schema pushed; see CONTRIBUTING.md,
// "Database tests". Skipped when RESEND_API_KEY is set so it never sends email.
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl || !!process.env.RESEND_API_KEY)(
  "sendApiSunsetEmailsDue (MySQL)",
  () => {
    const PAID = "api_sunset_paid";
    const FREE = "api_sunset_free";
    const USERS = [PAID, FREE];
    const CUTOFF = API_FREE_ACCESS_SUNSET_AT;

    beforeAll(() => {
      if (!env.DATABASE_URL) Object.assign(env, { DATABASE_URL: testDatabaseUrl });
    });

    async function cleanup() {
      await db.delete(schema.token).where(inArray(schema.token.userId, USERS));
      await db.delete(schema.subscription).where(inArray(schema.subscription.userId, USERS));
      await db.delete(schema.user).where(inArray(schema.user.id, USERS));
    }

    beforeEach(async () => {
      await cleanup();
      await db.insert(schema.user).values([
        { id: PAID, email: "paid@api-sunset.test" },
        { id: FREE, email: "free@api-sunset.test" },
      ]);
      await db
        .insert(schema.subscription)
        .values({ userId: PAID, status: "active", plan: "pro", variantId: 1811616 });
      await db.insert(schema.token).values(
        USERS.map((userId) => ({
          userId,
          token: crypto.createHash("sha256").update(userId).digest("hex"),
        })),
      );
    });

    afterAll(async () => {
      await cleanup();
    });

    async function noticeSentAt(userId: string) {
      const row = await db.query.user.findFirst({ where: eq(schema.user.id, userId) });
      return row?.apiSunsetNoticeSentAt ?? null;
    }

    test("accounts without a subscription row are not treated as paid", async () => {
      const rows = await db
        .select({ id: schema.user.id })
        .from(schema.user)
        .leftJoin(schema.subscription, eq(schema.subscription.userId, schema.user.id))
        .where(
          and(
            inArray(schema.user.id, USERS),
            not(paidSubscription(new Date(CUTOFF.getTime() - HOUR))),
          ),
        );

      expect(rows.map((row) => row.id)).toEqual([FREE]);
    });

    test("emails no one whose keys are already cut off", async () => {
      const result = await sendApiSunsetEmailsDue(new Date(CUTOFF.getTime() + HOUR));
      expect(result.sent).toBe(0);
      expect(await noticeSentAt(FREE)).toBeNull();
    });

    test("leaves Free owners unmarked when the email can't be sent, so they're retried", async () => {
      await sendApiSunsetEmailsDue(new Date(CUTOFF.getTime() - 3 * DAY));

      expect(await noticeSentAt(FREE)).toBeNull();
    });

    test("leaves paid owners unmarked and unemailed, so a later lapse still gets the notice", async () => {
      await db.delete(schema.token).where(eq(schema.token.userId, FREE));

      const result = await sendApiSunsetEmailsDue(new Date(CUTOFF.getTime() - 3 * DAY));

      expect(result).toEqual({ sent: 0, skipped: 0 });
      expect(await noticeSentAt(PAID)).toBeNull();
    });
  },
);
