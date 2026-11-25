import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { callProcedure } from "@trpc/server";
import { eq } from "drizzle-orm";

import { env } from "@/env.mjs";
import { ACCOUNT_RESTRICTED_MESSAGE } from "@/lib/constants/moderation";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";

import { appRouter } from "./root";
import { banUser, unbanUser } from "./routers/admin/admin.service";
import { RESTRICTED_LINK_REASON } from "./routers/link/utils";
import { contentWriteProcedure } from "./trpc";

import type { ProtectedTRPCContext } from "./trpc";

// Every tRPC path that creates or edits links, custom domains, bio pages or QR
// codes (the CSV import is link.bulkUpload). A restricted account must be
// refused on each of them, in personal and team workspaces alike.
const WRITE_PATHS = [
  "link.create",
  "link.update",
  "link.quickShorten",
  "link.toggleLinkStatus",
  "link.changeLinkPassword",
  "link.bulkUpload",
  "link.transferToWorkspace",
  "link.bulkToggleStatus",
  "customDomain.create",
  "qrCode.create",
  "qrCode.saveImage",
  "qrCode.update",
  "qrCode.toggleStatus",
  "bioPage.create",
  "bioPage.update",
  "bioPage.togglePublished",
  "bioPage.addBlock",
  "bioPage.updateBlock",
  "bioPage.reorderBlocks",
  "geoRules.create",
  "geoRules.update",
  "geoRules.delete",
  "geoRules.reorder",
  "campaign.addLinks",
] as const;

// Restricted accounts keep reading and cleaning up what they already have.
const OPEN_PATHS = [
  "link.list",
  "link.delete",
  "link.bulkDelete",
  "customDomain.list",
  "customDomain.delete",
  "qrCode.delete",
  "bioPage.delete",
] as const;

const procedures = appRouter._def.procedures;
const restrictionGuard = contentWriteProcedure._def.middlewares.at(-1);

describe("contentWriteProcedure", () => {
  test.each(WRITE_PATHS)("%s runs the restriction guard", (path) => {
    expect(procedures[path]?._def.middlewares).toContain(restrictionGuard);
  });

  test.each(OPEN_PATHS)("%s stays open to restricted accounts", (path) => {
    expect(procedures[path]).toBeDefined();
    expect(procedures[path]?._def.middlewares).not.toContain(restrictionGuard);
  });
});

// End to end through the real middleware chain; see CONTRIBUTING.md, "Database tests".
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("restricted account write paths (MySQL)", () => {
  const USER_ID = "restricted_write_paths_test";
  const OTHER_USER_ID = "restricted_write_paths_other";
  const OTHER_EMAIL = "restricted-write-other@example.com";
  const TEAM_SLUG = "restrictedwritetest";
  const DOMAIN = "restricted-write-test.example";

  async function cleanup() {
    for (const id of [USER_ID, OTHER_USER_ID]) {
      await db.delete(schema.customDomain).where(eq(schema.customDomain.userId, id));
      await db.delete(schema.subscription).where(eq(schema.subscription.userId, id));
    }
    await db.delete(schema.accountTransfer).where(eq(schema.accountTransfer.fromUserId, USER_ID));
    await db.delete(schema.user).where(eq(schema.user.id, OTHER_USER_ID));
    const teams = await db.select().from(schema.team).where(eq(schema.team.slug, TEAM_SLUG));
    for (const t of teams) {
      await db.delete(schema.teamMember).where(eq(schema.teamMember.teamId, t.id));
    }
    await db.delete(schema.team).where(eq(schema.team.slug, TEAM_SLUG));
    await db.delete(schema.link).where(eq(schema.link.userId, USER_ID));
    await db.delete(schema.user).where(eq(schema.user.id, USER_ID));
  }

  beforeAll(async () => {
    // Another test file replaces @/env.mjs with a partial object for the whole
    // run, dropping DATABASE_URL; the app's db client reads it on first use.
    if (!env.DATABASE_URL) Object.assign(env, { DATABASE_URL: testDatabaseUrl });
    await cleanup();
    await db.insert(schema.user).values({
      id: USER_ID,
      email: `${USER_ID}@example.com`,
      restrictedAt: new Date(),
      restrictedReason: "test",
    });
    const [team] = await db
      .insert(schema.team)
      .values({ name: "Restricted test", slug: TEAM_SLUG, ownerId: USER_ID });
    await db
      .insert(schema.teamMember)
      .values({ teamId: Number(team.insertId), userId: USER_ID, role: "owner" });

    // A second, unrestricted account the restricted owner controls: a member of
    // its team, with a plan that allows custom domains.
    await db.insert(schema.user).values({ id: OTHER_USER_ID, email: OTHER_EMAIL });
    await db
      .insert(schema.teamMember)
      .values({ teamId: Number(team.insertId), userId: OTHER_USER_ID, role: "member" });
    await db
      .insert(schema.subscription)
      .values({ userId: OTHER_USER_ID, status: "active", plan: "pro" });
    await db
      .insert(schema.customDomain)
      .values({ userId: USER_ID, teamId: Number(team.insertId), domain: DOMAIN });
  });

  afterAll(cleanup);

  // The guard runs before input parsing, so an empty input reaches it on every path.
  function call(host: string, path: string) {
    return callProcedure({
      procedures,
      path,
      rawInput: {},
      type: "mutation",
      ctx: { db, headers: new Headers({ host }), auth: { userId: USER_ID } },
    });
  }

  for (const [workspace, host] of [
    ["personal", "localhost:3000"],
    ["team", `${TEAM_SLUG}.localhost:3000`],
  ] as const) {
    test.each(WRITE_PATHS)(`%s is refused in a ${workspace} workspace`, async (path) => {
      await expect(call(host, path)).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: ACCOUNT_RESTRICTED_MESSAGE,
      });
    });
  }

  test("account transfer cannot be validated or initiated", async () => {
    for (const path of ["accountTransfer.validate", "accountTransfer.initiate"]) {
      await expect(
        callProcedure({
          procedures,
          path,
          rawInput: { targetEmail: OTHER_EMAIL },
          type: "mutation",
          ctx: { db, headers: new Headers(), auth: { userId: USER_ID } },
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN", message: ACCOUNT_RESTRICTED_MESSAGE });
    }
  });

  test("a transfer started before the restriction cannot be accepted", async () => {
    const token = "restricted-write-test-token".padEnd(64, "0");
    await db.insert(schema.accountTransfer).values({
      fromUserId: USER_ID,
      toEmail: OTHER_EMAIL,
      token,
      expiresAt: new Date(Date.now() + 86_400_000),
    });

    await expect(
      callProcedure({
        procedures,
        path: "accountTransfer.accept",
        rawInput: { token },
        type: "mutation",
        ctx: { db, headers: new Headers(), auth: { userId: OTHER_USER_ID } },
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const [transfer] = await db
      .select({ status: schema.accountTransfer.status })
      .from(schema.accountTransfer)
      .where(eq(schema.accountTransfer.token, token));
    expect(transfer?.status).toBe("pending");
  });

  test("a teammate cannot re-add a hostname the restricted account claims", async () => {
    await expect(
      callProcedure({
        procedures,
        path: "customDomain.create",
        rawInput: { domain: DOMAIN },
        type: "mutation",
        ctx: {
          db,
          headers: new Headers({ host: "localhost:3000" }),
          auth: { userId: OTHER_USER_ID },
        },
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", message: ACCOUNT_RESTRICTED_MESSAGE });

    const claims = await db
      .select()
      .from(schema.customDomain)
      .where(eq(schema.customDomain.userId, OTHER_USER_ID));
    expect(claims).toEqual([]);
  });

  test("ban then unban leaves restriction-blocked links blocked", async () => {
    await db.insert(schema.link).values([
      { userId: USER_ID, alias: "restricted-ban-a", url: "https://example.com/a" },
      {
        userId: USER_ID,
        alias: "restricted-ban-b",
        url: "https://example.com/b",
        blocked: true,
        blockedAt: new Date(),
        blockedReason: RESTRICTED_LINK_REASON,
      },
    ]);
    // SAFETY: banUser/unbanUser only read ctx.db and ctx.auth.userId.
    const adminCtx = { db, auth: { userId: OTHER_USER_ID } } as ProtectedTRPCContext;

    await banUser(adminCtx, { userId: USER_ID, reason: "test" });
    await unbanUser(adminCtx, { userId: USER_ID });

    const links = await db
      .select({
        alias: schema.link.alias,
        blocked: schema.link.blocked,
        reason: schema.link.blockedReason,
      })
      .from(schema.link)
      .where(eq(schema.link.userId, USER_ID));
    expect(links.find((l) => l.alias === "restricted-ban-a")).toMatchObject({
      blocked: false,
      reason: null,
    });
    expect(links.find((l) => l.alias === "restricted-ban-b")).toMatchObject({
      blocked: true,
      reason: RESTRICTED_LINK_REASON,
    });
    await db.delete(schema.link).where(eq(schema.link.userId, USER_ID));
  });

  test("reads still work", async () => {
    const result = await callProcedure({
      procedures,
      path: "link.list",
      rawInput: { page: 1, pageSize: 10 },
      type: "query",
      ctx: { db, headers: new Headers({ host: "localhost:3000" }), auth: { userId: USER_ID } },
    });
    expect(result).toBeDefined();
  });

  test("no link was created", async () => {
    const links = await db.select().from(schema.link).where(eq(schema.link.userId, USER_ID));
    expect(links).toEqual([]);
  });
});
