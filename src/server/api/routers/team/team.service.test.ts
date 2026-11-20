import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import crypto from "node:crypto";

import { TRPCError } from "@trpc/server";
import { addDays } from "date-fns";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

import * as schema from "@/server/db/schema";

import {
  acceptInvite,
  createInvite,
  declineInvite,
  getInviteByToken,
  listInvites,
  updateMemberRole,
} from "./team.service";
import { DAILY_INVITE_EMAIL_LIMIT } from "./utils";

import type { ProtectedTRPCContext, TeamTRPCContext } from "../../trpc";
import type { TeamRole } from "@/server/db/schema";

// Exercises the services against a real MySQL. Set TEST_DATABASE_URL to run
// them; see CONTRIBUTING.md, "Database tests".
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("team service (MySQL)", () => {
  const pool = mysql.createPool({ uri: testDatabaseUrl ?? "", connectionLimit: 5 });
  const db = drizzle(pool, { schema, mode: "default" });

  const OWNER = "team_test_owner";
  const ADMIN = "team_test_admin";
  const ADMIN_2 = "team_test_admin_2";
  const OUTSIDER = "team_test_outsider";
  const USERS = [OWNER, ADMIN, ADMIN_2, OUTSIDER];
  const SLUG = "team-service-test";

  // Seeding takes a dozen round trips; the default 5s is tight on a busy CI box.
  const HOOK_TIMEOUT_MS = 30_000;

  let teamId = 0;

  async function cleanup() {
    const existing = await db.query.team.findFirst({ where: eq(schema.team.slug, SLUG) });
    if (existing) {
      await db.delete(schema.teamInvite).where(eq(schema.teamInvite.teamId, existing.id));
      await db.delete(schema.teamMember).where(eq(schema.teamMember.teamId, existing.id));
      await db.delete(schema.team).where(eq(schema.team.id, existing.id));
    }
    await db.delete(schema.user).where(inArray(schema.user.id, USERS));
  }

  beforeEach(async () => {
    await cleanup();
    await db.insert(schema.user).values([
      { id: OWNER, name: "Owner", email: "owner@acme.test" },
      { id: ADMIN, name: "Admin", email: "admin@acme.test" },
      { id: ADMIN_2, name: "Admin Two", email: "admin2@acme.test" },
      { id: OUTSIDER, name: "John", email: "john@acme.test" },
    ]);
    const [inserted] = await db
      .insert(schema.team)
      .values({ name: "Acme", slug: SLUG, ownerId: OWNER });
    teamId = Number(inserted.insertId);
    await db.insert(schema.teamMember).values([
      { teamId, userId: OWNER, role: "owner" },
      { teamId, userId: ADMIN, role: "admin" },
      { teamId, userId: ADMIN_2, role: "admin" },
    ]);
  }, HOOK_TIMEOUT_MS);

  afterAll(async () => {
    await cleanup();
    await pool.end();
  });

  function protectedCtx(userId: string) {
    // SAFETY: the team services only read ctx.db and ctx.auth.userId.
    return { db, auth: { userId } } as ProtectedTRPCContext;
  }

  async function teamCtx(userId: string, role: TeamRole) {
    const teamRow = await db.query.team.findFirst({ where: eq(schema.team.id, teamId) });
    const membership = await db.query.teamMember.findFirst({
      where: eq(schema.teamMember.userId, userId),
    });
    if (!teamRow || !membership) throw new Error("test team not seeded");
    // SAFETY: mirrors what teamProcedure resolves for a member of the test team.
    return {
      db,
      auth: { userId },
      workspace: {
        type: "team",
        userId,
        teamId,
        teamSlug: SLUG,
        team: teamRow,
        membership,
        role,
        plan: "ultra",
      },
    } as TeamTRPCContext;
  }

  async function insertInvite(values: Partial<typeof schema.teamInvite.$inferInsert> = {}) {
    const token = crypto.randomBytes(32).toString("hex");
    await db.insert(schema.teamInvite).values({
      teamId,
      role: "member",
      token,
      invitedBy: OWNER,
      expiresAt: addDays(new Date(), 7),
      ...values,
    });
    return token;
  }

  async function errorOf(promise: Promise<unknown>) {
    try {
      await promise;
    } catch (error) {
      if (error instanceof TRPCError) return error;
      throw error;
    }
    throw new Error("expected a TRPCError");
  }

  async function roleOf(userId: string) {
    const row = await db.query.teamMember.findFirst({
      where: eq(schema.teamMember.userId, userId),
    });
    return row?.role;
  }

  test("an admin can't demote another admin", async () => {
    const error = await errorOf(
      updateMemberRole(await teamCtx(ADMIN, "admin"), { userId: ADMIN_2, role: "member" }),
    );
    expect(error.code).toBe("FORBIDDEN");
    expect(await roleOf(ADMIN_2)).toBe("admin");
  });

  test("the owner can demote an admin", async () => {
    await updateMemberRole(await teamCtx(OWNER, "owner"), { userId: ADMIN_2, role: "member" });
    expect(await roleOf(ADMIN_2)).toBe("member");
  });

  test("an email invite is accepted regardless of letter case", async () => {
    const token = await insertInvite({ email: "John@Acme.test" });
    await acceptInvite(protectedCtx(OUTSIDER), { token });
    expect(await roleOf(OUTSIDER)).toBe("member");
  });

  test("declining marks the invite declined and keeps it listed for the team", async () => {
    const token = await insertInvite({ email: "john@acme.test" });
    await declineInvite(protectedCtx(OUTSIDER), { token });

    const invites = await listInvites(await teamCtx(OWNER, "owner"));
    expect(invites.map((i) => i.status)).toEqual(["declined"]);

    const error = await errorOf(acceptInvite(protectedCtx(OUTSIDER), { token }));
    expect(error.code).toBe("BAD_REQUEST");
    expect(await roleOf(OUTSIDER)).toBeUndefined();
  });

  test("someone else can't decline an email invite", async () => {
    const token = await insertInvite({ email: "john@acme.test" });
    const error = await errorOf(declineInvite(protectedCtx(ADMIN), { token }));
    expect(error.code).toBe("FORBIDDEN");
  });

  test("a used link invite tells the next person it was used", async () => {
    const token = await insertInvite({ acceptedAt: new Date() });
    const forOutsider = await getInviteByToken(protectedCtx(OUTSIDER), token);
    expect(forOutsider?.view).toBe("used");

    const forMember = await getInviteByToken(protectedCtx(ADMIN), token);
    expect(forMember?.view).toBe("member");
  });

  test("refuses a second pending invite to the same email", async () => {
    await insertInvite({ email: "John@Acme.test" });
    const error = await errorOf(
      createInvite(await teamCtx(OWNER, "owner"), { email: " john@acme.test", role: "member" }),
    );
    expect(error.code).toBe("CONFLICT");
  });

  test("caps invite emails per team per day, counting revoked ones", async () => {
    await db.insert(schema.teamInvite).values(
      Array.from({ length: DAILY_INVITE_EMAIL_LIMIT }, (_, i) => ({
        teamId,
        email: `person${i}@acme.test`,
        role: "member" as const,
        token: crypto.randomBytes(32).toString("hex"),
        invitedBy: OWNER,
        expiresAt: addDays(new Date(), 7),
        revokedAt: new Date(),
      })),
    );
    const error = await errorOf(
      createInvite(await teamCtx(OWNER, "owner"), { email: "new@acme.test", role: "member" }),
    );
    expect(error.code).toBe("TOO_MANY_REQUESTS");
  });
});
