import { afterAll, beforeEach, describe, expect, test } from "bun:test";

import { subDays } from "date-fns";
import { inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

import * as schema from "@/server/db/schema";

import { sendDomainConfigurationReminders } from "./domain-reminder.service";

import type { CloudflareCustomHostname } from "./cloudflare";

// Exercises the cron against a real MySQL. Set TEST_DATABASE_URL to run it;
// see CONTRIBUTING.md, "Database tests".
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("domain reminder cron (MySQL)", () => {
  const pool = mysql.createPool({ uri: testDatabaseUrl ?? "", connectionLimit: 5 });
  const db = drizzle(pool, { schema, mode: "default" });

  const RESTRICTED = "reminder_test_restricted";
  const BANNED = "reminder_test_banned";
  const GOOD = "reminder_test_good";
  const USERS = [RESTRICTED, BANNED, GOOD];
  const TEAM_SLUG = "domain-reminder-test";
  const GOOD_TEAM_SLUG = "domain-reminder-test-good";

  const RESTRICTED_DOMAIN = "links.restricted-reminder.test";
  const BANNED_DOMAIN = "links.banned-reminder.test";
  const RESTRICTED_TEAM_DOMAIN = "go.restricted-reminder.test";
  const RESTRICTED_MEMBER_DOMAIN = "member.good-reminder.test";
  const HEALTHY_DOMAIN = "links.good-reminder.test";
  const BROKEN_DOMAIN = "go.good-reminder.test";
  const HELD_DOMAIN = "login.good-reminder.test";
  const TEST_DOMAINS = [
    RESTRICTED_DOMAIN,
    BANNED_DOMAIN,
    RESTRICTED_TEAM_DOMAIN,
    RESTRICTED_MEMBER_DOMAIN,
    HEALTHY_DOMAIN,
    BROKEN_DOMAIN,
    HELD_DOMAIN,
  ];
  const HOOK_TIMEOUT_MS = 30_000;

  async function cleanup() {
    const existing = await db.query.team.findMany({
      where: inArray(schema.team.slug, [TEAM_SLUG, GOOD_TEAM_SLUG]),
    });
    const teamIds = existing.map((row) => row.id);
    if (teamIds.length > 0) {
      await db.delete(schema.teamMember).where(inArray(schema.teamMember.teamId, teamIds));
      await db.delete(schema.team).where(inArray(schema.team.id, teamIds));
    }
    await db.delete(schema.customDomain).where(inArray(schema.customDomain.userId, USERS));
    await db.delete(schema.user).where(inArray(schema.user.id, USERS));
  }

  beforeEach(async () => {
    await cleanup();
    await db.insert(schema.user).values([
      {
        id: RESTRICTED,
        email: "restricted@reminder.test",
        restrictedAt: new Date(),
        restrictedReason: "test",
      },
      { id: BANNED, email: "banned@reminder.test", banned: true },
      { id: GOOD, email: "good@reminder.test" },
    ]);
    const [inserted] = await db
      .insert(schema.team)
      .values({ name: "Restricted", slug: TEAM_SLUG, ownerId: RESTRICTED });
    const teamId = Number(inserted.insertId);
    const [insertedGood] = await db
      .insert(schema.team)
      .values({ name: "Good", slug: GOOD_TEAM_SLUG, ownerId: GOOD });
    const goodTeamId = Number(insertedGood.insertId);
    await db.insert(schema.teamMember).values([
      { teamId, userId: RESTRICTED, role: "owner" },
      { teamId: goodTeamId, userId: GOOD, role: "owner" },
      { teamId: goodTeamId, userId: RESTRICTED, role: "admin" },
    ]);

    // Past the pending grace period, so every domain is due a reminder
    const createdAt = subDays(new Date(), 10);
    await db.insert(schema.customDomain).values([
      { userId: RESTRICTED, domain: RESTRICTED_DOMAIN, status: "pending", createdAt },
      { userId: BANNED, domain: BANNED_DOMAIN, status: "pending", createdAt },
      { userId: RESTRICTED, teamId, domain: RESTRICTED_TEAM_DOMAIN, status: "pending", createdAt },
      // Added by a restricted member to a team whose owner is in good standing
      {
        userId: RESTRICTED,
        teamId: goodTeamId,
        domain: RESTRICTED_MEMBER_DOMAIN,
        status: "pending",
        createdAt,
      },
      { userId: GOOD, domain: HEALTHY_DOMAIN, status: "pending", createdAt },
      { userId: GOOD, domain: BROKEN_DOMAIN, status: "invalid", createdAt },
      { userId: GOOD, domain: HELD_DOMAIN, status: "pending", reviewStatus: "held", createdAt },
    ]);
  }, HOOK_TIMEOUT_MS);

  afterAll(async () => {
    await cleanup();
    await pool.end();
  });

  test("skips domains of restricted and banned accounts and held domains, and still handles everyone else", async () => {
    const checked: string[] = [];
    const emailed: string[] = [];

    await sendDomainConfigurationReminders({
      // Every test domain except BROKEN_DOMAIN is live on Cloudflare
      checkHealth: async (domain) => {
        checked.push(domain);
        const hostname: CloudflareCustomHostname = {
          id: "id",
          hostname: domain,
          status: "active",
          ssl: { status: "active" },
        };
        return TEST_DOMAINS.includes(domain) && domain !== BROKEN_DOMAIN
          ? { healthy: true, hostname }
          : { healthy: false, hostname: null };
      },
      // Rows other suites left behind get a failed send, which writes nothing
      sendReminder: async ({ domain }) => {
        emailed.push(domain);
        return TEST_DOMAINS.includes(domain);
      },
    });

    const rows = await db.query.customDomain.findMany({
      where: inArray(schema.customDomain.domain, TEST_DOMAINS),
    });
    const status = Object.fromEntries(rows.map((row) => [row.domain, row.status]));
    const reminded = rows.filter((row) => row.lastReminderSentAt).map((row) => row.domain);

    for (const domain of [
      RESTRICTED_DOMAIN,
      BANNED_DOMAIN,
      RESTRICTED_TEAM_DOMAIN,
      RESTRICTED_MEMBER_DOMAIN,
      HELD_DOMAIN,
    ]) {
      expect(status[domain]).toBe("pending");
      expect(checked).not.toContain(domain);
      expect(emailed).not.toContain(domain);
    }
    expect(status[HEALTHY_DOMAIN]).toBe("active");
    expect(emailed).toContain(BROKEN_DOMAIN);
    expect(reminded).toEqual([BROKEN_DOMAIN]);
  });
});
