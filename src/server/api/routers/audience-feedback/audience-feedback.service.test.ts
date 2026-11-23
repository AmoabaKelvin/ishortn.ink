import { afterAll, beforeEach, describe, expect, test } from "bun:test";

import { TRPCError } from "@trpc/server";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

import * as schema from "@/server/db/schema";

import {
  dismissAcquisition,
  getAcquisitionPrompt,
  submitAcquisition,
} from "./audience-feedback.service";

import type { ProtectedTRPCContext } from "../../trpc";

// Exercises the service against a real MySQL. Set TEST_DATABASE_URL to run it;
// see CONTRIBUTING.md, "Database tests".
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("audience feedback acquisition service (MySQL)", () => {
  const pool = mysql.createPool({ uri: testDatabaseUrl ?? "", connectionLimit: 5 });
  const db = drizzle(pool, { schema, mode: "default" });

  const PAID = "acq_test_paid";
  const FREE = "acq_test_free";
  const USERS = [PAID, FREE];
  const DAY_MS = 24 * 60 * 60 * 1000;

  function ctxFor(userId: string) {
    // SAFETY: the acquisition services only read ctx.db and ctx.auth.userId.
    return { db, auth: { userId } } as ProtectedTRPCContext;
  }

  async function feedbackRow(userId: string) {
    return db.query.audienceFeedback.findFirst({
      where: eq(schema.audienceFeedback.userId, userId),
    });
  }

  async function cleanup() {
    await db.delete(schema.audienceFeedback).where(inArray(schema.audienceFeedback.userId, USERS));
    await db.delete(schema.subscription).where(inArray(schema.subscription.userId, USERS));
    await db.delete(schema.user).where(inArray(schema.user.id, USERS));
  }

  beforeEach(async () => {
    await cleanup();
    await db.insert(schema.user).values([
      { id: PAID, name: "Paid", email: "paid@acq.test" },
      { id: FREE, name: "Free", email: "free@acq.test" },
    ]);
    await db.insert(schema.subscription).values({
      userId: PAID,
      subscriptionId: 1,
      status: "active",
      plan: "pro",
    });
  });

  afterAll(async () => {
    await cleanup();
    await pool.end();
  });

  test("stores the answer without touching full-survey answers", async () => {
    const surveyAnswers = {
      role: "marketer",
      monthlyVolume: "11_50",
      priorTool: "bitly",
      switchReason: "Price",
      magicFeature: "analytics",
      improvementWish: "Zapier",
    };
    const dismissedAt = new Date("2026-11-01T00:00:00Z");
    await db.insert(schema.audienceFeedback).values({
      userId: PAID,
      ...surveyAnswers,
      useCase: "client_links",
      planSnapshot: "free",
      dismissedAt,
      dismissCount: 2,
    });

    const now = new Date("2026-11-22T12:00:00Z");
    await submitAcquisition(
      ctxFor(PAID),
      { acquisitionChannel: "community", acquisitionDetail: "Indie Hackers post" },
      now,
    );

    const row = await feedbackRow(PAID);
    expect(row).toMatchObject({
      ...surveyAnswers,
      // No use case given, so the earlier one stays.
      useCase: "client_links",
      acquisitionChannel: "community",
      acquisitionDetail: "Indie Hackers post",
      planSnapshot: "pro",
      acquisitionAnsweredAt: now,
      submittedAt: null,
      dismissedAt,
      dismissCount: 2,
    });

    expect((await getAcquisitionPrompt(ctxFor(PAID))).showOnDashboard).toBe(false);
  });

  test("creates the row for a paid account with no earlier feedback", async () => {
    await submitAcquisition(ctxFor(PAID), {
      acquisitionChannel: "search",
      useCase: "qr_codes",
    });

    const row = await feedbackRow(PAID);
    expect(row).toMatchObject({
      acquisitionChannel: "search",
      acquisitionDetail: null,
      useCase: "qr_codes",
      planSnapshot: "pro",
      submittedAt: null,
      dismissCount: 0,
    });
    expect(row?.acquisitionAnsweredAt).toBeInstanceOf(Date);
  });

  test("rejects free accounts and never prompts them", async () => {
    expect(await getAcquisitionPrompt(ctxFor(FREE))).toEqual({
      plan: "free",
      showOnDashboard: false,
      showAfterCheckout: false,
    });

    await expect(
      submitAcquisition(ctxFor(FREE), { acquisitionChannel: "ad" }),
    ).rejects.toBeInstanceOf(TRPCError);
    expect(await feedbackRow(FREE)).toBeUndefined();
  });

  test("Not now hides the card for 14 days and twice ends it", async () => {
    expect((await getAcquisitionPrompt(ctxFor(PAID))).showOnDashboard).toBe(true);

    const firstDismissal = new Date(Date.now() - 15 * DAY_MS);
    await dismissAcquisition(ctxFor(PAID), new Date());
    expect((await getAcquisitionPrompt(ctxFor(PAID))).showOnDashboard).toBe(false);

    // Move the first dismissal back past the cooldown: the card comes back once.
    await db
      .update(schema.audienceFeedback)
      .set({ acquisitionDismissedAt: firstDismissal })
      .where(eq(schema.audienceFeedback.userId, PAID));
    expect((await getAcquisitionPrompt(ctxFor(PAID))).showOnDashboard).toBe(true);

    await dismissAcquisition(ctxFor(PAID), new Date());
    const row = await feedbackRow(PAID);
    expect(row?.acquisitionDismissCount).toBe(2);
    // The full survey's own dismissal state is separate.
    expect(row?.dismissCount).toBe(0);
    expect(row?.dismissedAt).toBeNull();
    expect(await getAcquisitionPrompt(ctxFor(PAID))).toMatchObject({
      showOnDashboard: false,
      showAfterCheckout: false,
    });
  });
});
