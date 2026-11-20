import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import crypto from "node:crypto";

import { eq, inArray } from "drizzle-orm";

import { env } from "@/env.mjs";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";

import { dueApiSunsetEmail, sendApiSunsetEmailsDue } from "./api-access";

const HOUR = 60 * 60 * 1000;
const SUNSET = new Date("2026-11-27T12:00:00Z");

describe("dueApiSunsetEmail", () => {
  test("nothing is due without a configured sunset", () => {
    expect(dueApiSunsetEmail(null, new Date())).toBeNull();
  });

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

// Runs against a disposable MySQL with the schema pushed; see CONTRIBUTING.md,
// "Database tests". Skipped when RESEND_API_KEY is set so it never sends email.
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl || !!process.env.RESEND_API_KEY)(
  "sendApiSunsetEmailsDue (MySQL)",
  () => {
    const PAID = "api_sunset_paid";
    const FREE = "api_sunset_free";
    const USERS = [PAID, FREE];
    const originalSunset = env.API_FREE_ACCESS_SUNSET_AT;

    beforeAll(() => {
      if (!env.DATABASE_URL) Object.assign(env, { DATABASE_URL: testDatabaseUrl });
      Object.assign(env, { API_FREE_ACCESS_SUNSET_AT: SUNSET.toISOString() });
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
      Object.assign(env, { API_FREE_ACCESS_SUNSET_AT: originalSunset });
      await cleanup();
    });

    async function noticeSentAt(userId: string) {
      const row = await db.query.user.findFirst({ where: eq(schema.user.id, userId) });
      return row?.apiSunsetNoticeSentAt ?? null;
    }

    test("does nothing once the sunset has passed", async () => {
      const result = await sendApiSunsetEmailsDue(new Date(SUNSET.getTime() + HOUR));
      expect(result).toEqual({ kind: null, sent: 0, skipped: 0 });
    });

    test("leaves Free owners unmarked when the email can't be sent, so they're retried", async () => {
      await sendApiSunsetEmailsDue(new Date(SUNSET.getTime() - 3 * 24 * HOUR));

      expect(await noticeSentAt(FREE)).toBeNull();
    });

    test("marks paid owners as handled without emailing them", async () => {
      await db.delete(schema.token).where(eq(schema.token.userId, FREE));

      const result = await sendApiSunsetEmailsDue(new Date(SUNSET.getTime() - 3 * 24 * HOUR));

      expect(result).toEqual({ kind: "notice", sent: 0, skipped: 1 });
      expect(await noticeSentAt(PAID)).not.toBeNull();
    });
  },
);
