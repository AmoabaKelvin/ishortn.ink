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
});
