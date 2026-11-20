import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { callProcedure } from "@trpc/server";
import { eq } from "drizzle-orm";

import { env } from "@/env.mjs";
import { ACCOUNT_RESTRICTED_MESSAGE } from "@/lib/constants/moderation";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";

import { appRouter } from "./root";
import { contentWriteProcedure } from "./trpc";

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
  const TEAM_SLUG = "restrictedwritetest";

  async function cleanup() {
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
      restrictedAt: new Date(),
      restrictedReason: "test",
    });
    const [team] = await db
      .insert(schema.team)
      .values({ name: "Restricted test", slug: TEAM_SLUG, ownerId: USER_ID });
    await db
      .insert(schema.teamMember)
      .values({ teamId: Number(team.insertId), userId: USER_ID, role: "owner" });
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
