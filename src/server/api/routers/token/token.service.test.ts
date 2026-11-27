import { afterAll, beforeEach, describe, expect, test } from "bun:test";

import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

import * as schema from "@/server/db/schema";

import {
  MAX_EXTENSION_TOKENS_PER_USER,
  createExtensionToken,
  createTeamToken,
  createToken,
  deleteExtensionToken,
  deleteTeamToken,
  deleteToken,
  getTeamTokens,
  getApiAccessStatus,
  getExtensionTokens,
  getTokens,
} from "./token.service";

import type { ProtectedTRPCContext, TeamTRPCContext } from "../../trpc";
import type { Team, TeamRole } from "@/server/db/schema";
import type { TeamWorkspaceContext } from "@/server/lib/workspace";

// Exercises the service against a real MySQL. Set TEST_DATABASE_URL to run it;
// see CONTRIBUTING.md, "Database tests".
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("token service (MySQL)", () => {
  const pool = mysql.createPool({ uri: testDatabaseUrl ?? "", connectionLimit: 2 });
  const db = drizzle(pool, { schema, mode: "default" });
  const USER_ID = "token_service_test";

  // SAFETY: the token services only read ctx.db and ctx.auth.userId.
  const ctx = { db, auth: { userId: USER_ID } } as ProtectedTRPCContext;

  async function cleanup() {
    await db.delete(schema.token).where(eq(schema.token.userId, USER_ID));
    await db.delete(schema.subscription).where(eq(schema.subscription.userId, USER_ID));
    await db.delete(schema.user).where(eq(schema.user.id, USER_ID));
  }

  beforeEach(async () => {
    await cleanup();
    await db.insert(schema.user).values({ id: USER_ID });
  });

  afterAll(async () => {
    await cleanup();
    await pool.end();
  });

  async function tokenCount() {
    const rows = await db.select().from(schema.token).where(eq(schema.token.userId, USER_ID));
    return rows.length;
  }

  test("Free accounts can't create keys", async () => {
    const attempt = createToken(ctx, { name: "key" });

    await expect(attempt).rejects.toBeInstanceOf(TRPCError);
    await expect(attempt).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "API access is a Pro feature. Upgrade to Pro to create API keys.",
    });
    expect(await tokenCount()).toBe(0);
    expect((await getApiAccessStatus(ctx)).canCreateKeys).toBe(false);
  });

  test("lapsed accounts can't create keys", async () => {
    await db.insert(schema.subscription).values({
      userId: USER_ID,
      status: "cancelled",
      plan: "pro",
      variantId: 1811616,
      endsAt: new Date(Date.now() - 1000),
    });

    await expect(createToken(ctx, { name: "key" })).rejects.toThrow("API access is a Pro feature");
    expect(await tokenCount()).toBe(0);
  });

  test("Pro accounts create keys", async () => {
    await db.insert(schema.subscription).values({
      userId: USER_ID,
      status: "active",
      plan: "pro",
      variantId: 1811616,
    });

    const created = await createToken(ctx, { name: "key" });

    expect(created.token).toHaveLength(29);
    expect(created.name).toBe("key");
    expect(await tokenCount()).toBe(1);
    expect(await getApiAccessStatus(ctx)).toEqual({
      canCreateKeys: true,
      access: { status: "full" },
    });
  });

  test("Free accounts connect the extension; its tokens stay out of the API key list", async () => {
    const created = await createExtensionToken(ctx, { label: "Chrome on macOS" });
    expect(created.token).toHaveLength(29);

    const [stored] = await db.select().from(schema.token).where(eq(schema.token.userId, USER_ID));
    expect(stored).toMatchObject({ kind: "extension", label: "Chrome on macOS" });
    expect(stored?.token).not.toBe(created.token);
    expect(await getTokens(ctx)).toEqual([]);
    expect((await getExtensionTokens(ctx)).map((t) => t.label)).toEqual(["Chrome on macOS"]);
  });

  test("connecting one more browser than the cap revokes the oldest", async () => {
    for (let i = 0; i < MAX_EXTENSION_TOKENS_PER_USER; i++) {
      await db.insert(schema.token).values({
        userId: USER_ID,
        kind: "extension",
        label: `browser ${i}`,
        token: `hash-${i}`,
        createdAt: new Date(Date.UTC(2026, 0, 1 + i)),
      });
    }

    await createExtensionToken(ctx, { label: "newest" });

    const labels = (await getExtensionTokens(ctx)).map((t) => t.label);
    expect(labels).toHaveLength(MAX_EXTENSION_TOKENS_PER_USER);
    expect(labels).not.toContain("browser 0");
    expect(labels).toContain("browser 1");
    expect(labels[0]).toBe("newest");
  });

  test("API key and browser removal only touch their own kind", async () => {
    await createExtensionToken(ctx, { label: null });
    const [extension] = await getExtensionTokens(ctx);

    await expect(deleteToken(ctx, { id: extension!.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await deleteExtensionToken(ctx, { id: extension!.id });
    expect(await tokenCount()).toBe(0);
  });

  describe("team keys", () => {
    const TEAM_ID = 987_654;

    function teamCtx(role: TeamRole): TeamTRPCContext {
      const team: Team = {
        id: TEAM_ID,
        name: "Acme",
        slug: "acme",
        avatarUrl: null,
        defaultDomain: null,
        ownerId: USER_ID,
        createdAt: null,
        updatedAt: null,
        deletedAt: null,
        ownerPlanGraceEndsAt: null,
        ownerPlanGraceEmailStage: 0,
      };
      const workspace: TeamWorkspaceContext = {
        type: "team",
        userId: USER_ID,
        teamId: TEAM_ID,
        teamSlug: team.slug,
        team,
        membership: {
          id: 1,
          teamId: TEAM_ID,
          userId: USER_ID,
          role,
          createdAt: null,
          updatedAt: null,
        },
        role,
        plan: "ultra",
        readOnly: false,
        ownerGraceEndsAt: null,
      };
      // SAFETY: the team key services read only ctx.db, ctx.auth, ctx.restrictedAt and
      // ctx.workspace.
      return { db, auth: { userId: USER_ID }, restrictedAt: null, workspace } as TeamTRPCContext;
    }

    beforeEach(() => db.delete(schema.token).where(eq(schema.token.teamId, TEAM_ID)));
    afterAll(() => db.delete(schema.token).where(eq(schema.token.teamId, TEAM_ID)));

    test("admins create team keys; they stay out of the creator's personal list", async () => {
      await db
        .update(schema.user)
        .set({ name: "Ada", email: "ada@example.com" })
        .where(eq(schema.user.id, USER_ID));
      const created = await createTeamToken(teamCtx("admin"), { name: "Zapier" });

      const team = await getTeamTokens(teamCtx("member"));
      expect(team.keys.map((key) => key.id)).toEqual([created.id]);
      expect(team.keys[0]?.createdBy).toEqual({ name: "Ada", email: "ada@example.com" });
      expect(team.canManage).toBe(false);
      expect(await getTokens(ctx)).toEqual([]);
      // Personal revoke can't reach a team key.
      await expect(deleteToken(ctx, { id: created.id })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });

      const stored = await db.query.token.findFirst({ where: eq(schema.token.id, created.id) });
      expect(stored).toMatchObject({ teamId: TEAM_ID, userId: USER_ID, createdByUserId: USER_ID });
    });

    test("members can't create or revoke team keys", async () => {
      const created = await createTeamToken(teamCtx("owner"), { name: "n8n" });

      await expect(createTeamToken(teamCtx("member"), { name: "x" })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      await expect(deleteTeamToken(teamCtx("member"), { id: created.id })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });

      await deleteTeamToken(teamCtx("admin"), { id: created.id });
      expect((await getTeamTokens(teamCtx("admin"))).keys).toEqual([]);
    });
  });
});
