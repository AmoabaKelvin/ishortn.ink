import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { eq, inArray } from "drizzle-orm";

import { env } from "@/env.mjs";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";

import { cleanupDeletedTeams } from "./team-cleanup.service";

// Runs against a disposable MySQL with the schema pushed; see CONTRIBUTING.md, "Database tests".
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("cleanupDeletedTeams (MySQL)", () => {
  const OWNER = "team_cleanup_owner";
  const SLUGS = ["team-cleanup-deleted", "team-cleanup-active"];
  const teamIds: Record<string, number> = {};

  async function cleanup() {
    const hooks = await db
      .select({ id: schema.webhook.id })
      .from(schema.webhook)
      .where(eq(schema.webhook.userId, OWNER));
    if (hooks.length > 0) {
      await db.delete(schema.webhookDelivery).where(
        inArray(
          schema.webhookDelivery.webhookId,
          hooks.map((h) => h.id),
        ),
      );
    }
    await db.delete(schema.webhook).where(eq(schema.webhook.userId, OWNER));
    await db.delete(schema.scheduledReport).where(eq(schema.scheduledReport.userId, OWNER));
    await db.delete(schema.team).where(inArray(schema.team.slug, SLUGS));
  }

  function report(teamId: number | null) {
    return {
      userId: OWNER,
      teamId,
      createdBy: OWNER,
      targetType: "folder" as const,
      targetId: 1,
      frequency: "monthly" as const,
      recipients: ["client@example.com"],
    };
  }

  const webhookIds: Record<string, number> = {};

  beforeAll(async () => {
    // Another test file replaces @/env.mjs with a partial object for the whole run.
    if (!env.DATABASE_URL) Object.assign(env, { DATABASE_URL: testDatabaseUrl });
    await cleanup();
    for (const slug of SLUGS) {
      const [result] = await db.insert(schema.team).values({
        name: slug,
        slug,
        ownerId: OWNER,
        deletedAt: slug === "team-cleanup-deleted" ? new Date("2020-01-01T00:00:00Z") : null,
      });
      teamIds[slug] = result.insertId;
    }
    await db
      .insert(schema.scheduledReport)
      .values([
        report(teamIds["team-cleanup-deleted"]!),
        report(teamIds["team-cleanup-active"]!),
        report(null),
      ]);
    for (const [key, teamId] of [
      ["deleted", teamIds["team-cleanup-deleted"]!],
      ["active", teamIds["team-cleanup-active"]!],
      ["personal", null],
    ] as const) {
      const [result] = await db.insert(schema.webhook).values({
        userId: OWNER,
        teamId,
        url: "https://hooks.example.com/ishortn",
        events: ["link.created"],
        secret: "whsec_test",
      });
      webhookIds[key] = result.insertId;
      await db.insert(schema.webhookDelivery).values({
        webhookId: result.insertId,
        eventId: `evt_${result.insertId}`,
        eventType: "link.created",
        payload: "{}",
      });
    }
  });

  afterAll(cleanup);

  test("deletes the deleted team's scheduled reports and keeps other workspaces' ones", async () => {
    await cleanupDeletedTeams();

    const rows = await db
      .select({ teamId: schema.scheduledReport.teamId })
      .from(schema.scheduledReport)
      .where(eq(schema.scheduledReport.userId, OWNER));
    expect(rows.map((row) => row.teamId).sort()).toEqual(
      [teamIds["team-cleanup-active"]!, null].sort(),
    );

    const [deletedTeam] = await db
      .select()
      .from(schema.team)
      .where(eq(schema.team.id, teamIds["team-cleanup-deleted"]!));
    expect(deletedTeam).toBeUndefined();
  });

  test("deletes the deleted team's webhooks and their deliveries and keeps other workspaces' ones", async () => {
    const ids = Object.values(webhookIds);

    const hooks = await db
      .select({ id: schema.webhook.id })
      .from(schema.webhook)
      .where(inArray(schema.webhook.id, ids));
    expect(hooks.map((h) => h.id).sort()).toEqual(
      [webhookIds.active!, webhookIds.personal!].sort(),
    );

    const deliveries = await db
      .select({ webhookId: schema.webhookDelivery.webhookId })
      .from(schema.webhookDelivery)
      .where(inArray(schema.webhookDelivery.webhookId, ids));
    expect(deliveries.map((d) => d.webhookId).sort()).toEqual(
      [webhookIds.active!, webhookIds.personal!].sort(),
    );
  });
});
