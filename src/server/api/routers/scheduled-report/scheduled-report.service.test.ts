import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { eq, inArray } from "drizzle-orm";

import { env } from "@/env.mjs";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";

import { createScheduledReportInput } from "./scheduled-report.input";
import {
  createScheduledReport,
  deleteScheduledReport,
  listScheduledReports,
  updateScheduledReport,
} from "./scheduled-report.service";

import type { WorkspaceTRPCContext } from "../../trpc";
import type { Plan } from "@/lib/billing/plans";

describe("createScheduledReportInput", () => {
  const base = { targetType: "link", targetId: 1, frequency: "weekly" } as const;

  test("normalises and de-duplicates addresses", () => {
    const parsed = createScheduledReportInput.parse({
      ...base,
      recipients: [" Client@Example.com", "client@example.com", "b@example.com"],
    });
    expect(parsed.recipients).toEqual(["client@example.com", "b@example.com"]);
  });

  test("takes 1 to 5 valid addresses", () => {
    const parse = (recipients: string[]) =>
      createScheduledReportInput.safeParse({ ...base, recipients }).success;
    expect(parse([])).toBe(false);
    expect(parse(["not an email"])).toBe(false);
    expect(parse(["a@x.com", "b@x.com", "c@x.com", "d@x.com", "e@x.com"])).toBe(true);
    expect(parse(["a@x.com", "b@x.com", "c@x.com", "d@x.com", "e@x.com", "f@x.com"])).toBe(false);
  });
});

// Runs against a disposable MySQL with the schema pushed; see CONTRIBUTING.md, "Database tests".
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("scheduled report schedules (MySQL)", () => {
  const USER = "srs_test_owner";
  const OTHER = "srs_test_other";
  const USERS = [USER, OTHER];

  // SAFETY: the services read only db, workspace and auth.userId.
  const ctxFor = (userId: string, plan: Plan) =>
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
        plan,
      },
    }) as WorkspaceTRPCContext;

  let linkIds: number[] = [];
  let otherLink = 0;

  beforeAll(() => {
    if (!env.DATABASE_URL) Object.assign(env, { DATABASE_URL: testDatabaseUrl });
  });

  async function cleanup() {
    await db.delete(schema.scheduledReport).where(inArray(schema.scheduledReport.userId, USERS));
    await db.delete(schema.planLimitHit).where(inArray(schema.planLimitHit.userId, USERS));
    await db.delete(schema.link).where(inArray(schema.link.userId, USERS));
  }

  beforeEach(async () => {
    await cleanup();
    linkIds = [];
    for (const alias of ["srs-a", "srs-b", "srs-c", "srs-d"]) {
      const [result] = await db
        .insert(schema.link)
        .values({ url: "https://example.com", alias, userId: USER });
      linkIds.push(result.insertId);
    }
    const [other] = await db
      .insert(schema.link)
      .values({ url: "https://example.com", alias: "srs-other", userId: OTHER });
    otherLink = other.insertId;
  });

  afterAll(cleanup);

  const create = (plan: Plan, targetId: number) =>
    createScheduledReport(ctxFor(USER, plan), {
      targetType: "link",
      targetId,
      frequency: "weekly",
      recipients: ["client@example.com"],
    });

  test("creates, lists, edits and deletes a schedule", async () => {
    const ctx = ctxFor(USER, "pro");
    const { id } = await create("pro", linkIds[0]!);

    const target = { targetType: "link", targetId: linkIds[0]! } as const;
    expect(await listScheduledReports(ctx, target)).toMatchObject({
      reports: [
        {
          id,
          frequency: "weekly",
          recipients: ["client@example.com"],
          unsubscribed: [],
          paused: false,
        },
      ],
      plan: "pro",
      limit: 3,
      used: 1,
    });
    const [created] = await db
      .select({ createdBy: schema.scheduledReport.createdBy })
      .from(schema.scheduledReport)
      .where(eq(schema.scheduledReport.id, id));
    expect(created?.createdBy).toBe(USER);

    await updateScheduledReport(ctx, {
      id,
      frequency: "monthly",
      recipients: ["a@example.com", "b@example.com"],
    });
    const [row] = await db
      .select()
      .from(schema.scheduledReport)
      .where(eq(schema.scheduledReport.id, id));
    expect(row).toMatchObject({
      frequency: "monthly",
      recipients: ["a@example.com", "b@example.com"],
    });
    // Switching frequency starts with the month in progress, not the one that just ended.
    expect(row?.lastPeriodKey).toMatch(/^m:\d{4}-\d{2}-01$/);

    await deleteScheduledReport(ctx, { id });
    expect((await listScheduledReports(ctx, target)).reports).toEqual([]);
  });

  test("Free gets none, Pro gets 3 and Ultra is unlimited", async () => {
    await expect(create("free", linkIds[0]!)).rejects.toThrow("available on Pro and Ultra");

    for (const id of linkIds.slice(0, 3)) await create("pro", id);
    await expect(create("pro", linkIds[3]!)).rejects.toThrow("Upgrade to Ultra");
    expect(await create("ultra", linkIds[3]!)).toHaveProperty("id");
  });

  test("after a downgrade, schedules past the plan's oldest-first limit are paused", async () => {
    const ids: number[] = [];
    for (const id of linkIds) ids.push((await create("ultra", id)).id);
    const pausedOn = async (plan: Plan, index: number) =>
      (
        await listScheduledReports(ctxFor(USER, plan), {
          targetType: "link",
          targetId: linkIds[index]!,
        })
      ).reports.map((row) => ({ id: row.id, paused: row.paused }));

    expect(await pausedOn("pro", 2)).toEqual([{ id: ids[2]!, paused: false }]);
    expect(await pausedOn("pro", 3)).toEqual([{ id: ids[3]!, paused: true }]);
    expect(await pausedOn("free", 0)).toEqual([{ id: ids[0]!, paused: true }]);
    expect(await pausedOn("ultra", 3)).toEqual([{ id: ids[3]!, paused: false }]);
  });

  test("schedules on deleted links don't count toward the limit", async () => {
    for (const id of linkIds.slice(0, 3)) await create("pro", id);
    await db.delete(schema.link).where(eq(schema.link.id, linkIds[0]!));
    expect(await create("pro", linkIds[3]!)).toHaveProperty("id");
  });

  test("another workspace's link or schedule is not found", async () => {
    await expect(create("pro", otherLink)).rejects.toThrow("Link not found");

    const { id } = await create("pro", linkIds[0]!);
    const other = ctxFor(OTHER, "ultra");
    await expect(
      updateScheduledReport(other, { id, frequency: "weekly", recipients: ["x@example.com"] }),
    ).rejects.toThrow("Report not found");
    await expect(deleteScheduledReport(other, { id })).rejects.toThrow("Report not found");
  });
});
