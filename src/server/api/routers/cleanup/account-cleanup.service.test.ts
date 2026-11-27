import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { eq, inArray } from "drizzle-orm";

import { env } from "@/env.mjs";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";

import { cleanupDeletedAccounts } from "./account-cleanup.service";

// Runs against a disposable MySQL with the schema pushed; see CONTRIBUTING.md, "Database tests".
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("cleanupDeletedAccounts (MySQL)", () => {
  const PURGED = "acct_cleanup_purged";
  const KEPT = "acct_cleanup_kept";
  const USERS = [PURGED, KEPT];
  // No Team row is needed: the purge keys team-owned rows off teamId alone.
  const TEAM_ID = 990_001;

  async function cleanup() {
    const hooks = await db
      .select({ id: schema.webhook.id })
      .from(schema.webhook)
      .where(inArray(schema.webhook.userId, USERS));
    if (hooks.length > 0) {
      await db.delete(schema.webhookDelivery).where(
        inArray(
          schema.webhookDelivery.webhookId,
          hooks.map((h) => h.id),
        ),
      );
    }
    await db.delete(schema.webhook).where(inArray(schema.webhook.userId, USERS));
    await db.delete(schema.scheduledReport).where(inArray(schema.scheduledReport.userId, USERS));
    await db.delete(schema.user).where(inArray(schema.user.id, USERS));
  }

  function report(userId: string, teamId: number | null) {
    return {
      userId,
      teamId,
      createdBy: userId,
      targetType: "link" as const,
      targetId: 1,
      frequency: "weekly" as const,
      recipients: ["client@example.com"],
    };
  }

  function endpoint(userId: string, teamId: number | null) {
    return {
      userId,
      teamId,
      url: "https://hooks.example.com/ishortn",
      events: ["link.created" as const],
      secret: "whsec_test",
    };
  }

  function delivery(webhookId: number) {
    return { webhookId, eventId: `evt_${webhookId}`, eventType: "link.created", payload: "{}" };
  }

  const webhookIds: Record<string, number> = {};

  beforeAll(async () => {
    // Another test file replaces @/env.mjs with a partial object for the whole run.
    if (!env.DATABASE_URL) Object.assign(env, { DATABASE_URL: testDatabaseUrl });
    await cleanup();
    await db.insert(schema.user).values([
      { id: PURGED, email: `${PURGED}@example.com`, deletedAt: new Date("2020-01-01T00:00:00Z") },
      { id: KEPT, email: `${KEPT}@example.com` },
    ]);
    await db
      .insert(schema.scheduledReport)
      .values([report(PURGED, null), report(PURGED, TEAM_ID), report(KEPT, null)]);
    for (const [key, userId, teamId] of [
      ["purgedPersonal", PURGED, null],
      ["purgedTeam", PURGED, TEAM_ID],
      ["kept", KEPT, null],
    ] as const) {
      const [result] = await db.insert(schema.webhook).values(endpoint(userId, teamId));
      webhookIds[key] = result.insertId;
      await db.insert(schema.webhookDelivery).values(delivery(result.insertId));
    }
  });

  afterAll(cleanup);

  test("deletes the purged user's personal scheduled reports and keeps team and other users' ones", async () => {
    await cleanupDeletedAccounts(async () => {});

    const [purgedUser] = await db.select().from(schema.user).where(eq(schema.user.id, PURGED));
    expect(purgedUser).toBeUndefined();

    const rows = await db
      .select({ userId: schema.scheduledReport.userId, teamId: schema.scheduledReport.teamId })
      .from(schema.scheduledReport)
      .where(inArray(schema.scheduledReport.userId, USERS));
    expect(rows).toHaveLength(2);
    expect(rows).toContainEqual({ userId: PURGED, teamId: TEAM_ID });
    expect(rows).toContainEqual({ userId: KEPT, teamId: null });
  });

  test("deletes the purged user's personal webhooks and their deliveries and keeps the rest", async () => {
    const ids = Object.values(webhookIds);

    const hooks = await db
      .select({ id: schema.webhook.id })
      .from(schema.webhook)
      .where(inArray(schema.webhook.id, ids));
    expect(hooks.map((h) => h.id).sort()).toEqual(
      [webhookIds.purgedTeam!, webhookIds.kept!].sort(),
    );

    const deliveries = await db
      .select({ webhookId: schema.webhookDelivery.webhookId })
      .from(schema.webhookDelivery)
      .where(inArray(schema.webhookDelivery.webhookId, ids));
    expect(deliveries.map((d) => d.webhookId).sort()).toEqual(
      [webhookIds.purgedTeam!, webhookIds.kept!].sort(),
    );
  });
});
