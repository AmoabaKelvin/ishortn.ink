import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { TRPCError } from "@trpc/server";
import { inArray } from "drizzle-orm";

import { env } from "@/env.mjs";
import { cleanupDeletedAccounts } from "@/server/api/routers/cleanup/account-cleanup.service";
import {
  bulkDeleteLinks,
  checkAliasAvailability as checkPublicAliasAvailability,
  deleteLink,
  updateLink,
} from "@/server/api/routers/link/link.service";
import { checkAliasAvailability } from "@/server/api/routers/link/utils";
import { deleteQrCode } from "@/server/api/routers/qrcode/qrcode.service";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";

import { generateUnreservedAlias, isAliasReserved } from "./reserved-alias";

import type { PublicTRPCContext, WorkspaceTRPCContext } from "@/server/api/trpc";

// Runs against a disposable MySQL with the schema pushed; see CONTRIBUTING.md,
// "Database tests".
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("alias tombstones (MySQL)", () => {
  const OWNER = "reserved_alias_owner";
  const OTHER = "reserved_alias_other";
  const PURGED = "reserved_alias_purged";
  const USERS = [OWNER, OTHER, PURGED];
  const CUSTOM_DOMAIN = "go.reserved-alias.test";
  const ALIASES = ["tomb-single", "tomb-bulk-1", "tomb-bulk-2", "tomb-qr", "tomb-purged"];

  function workspaceCtx(userId: string): WorkspaceTRPCContext {
    // SAFETY: the services under test read only db, auth.userId, restrictedAt
    // and the personal workspace fields set here.
    return {
      db,
      auth: { userId },
      restrictedAt: null,
      workspace: {
        type: "personal",
        userId,
        teamId: null,
        teamSlug: null,
        role: "owner",
        plan: "pro",
      },
    } as WorkspaceTRPCContext;
  }

  // SAFETY: checkAliasAvailability reads only ctx.db.
  const publicCtx = { db } as PublicTRPCContext;

  async function insertLink(
    alias: string,
    domain = "ishortn.ink",
    userId = OWNER,
    isQrCode = false,
  ) {
    const [result] = await db
      .insert(schema.link)
      .values({ url: "https://example.com", alias, domain, userId, isQrCode });
    return Number(result.insertId);
  }

  async function expectTaken(alias: string, domain = "ishortn.ink") {
    let error: unknown;
    try {
      await checkAliasAvailability({ db }, alias, domain);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(TRPCError);
    expect(error instanceof TRPCError && error.message).toBe("Alias already exists");
  }

  async function cleanup() {
    await db.delete(schema.reservedAlias).where(inArray(schema.reservedAlias.alias, ALIASES));
    await db.delete(schema.qrcode).where(inArray(schema.qrcode.userId, USERS));
    await db.delete(schema.link).where(inArray(schema.link.userId, USERS));
    await db.delete(schema.user).where(inArray(schema.user.id, USERS));
  }

  // OpenNext reads the request context from this global; the delete paths
  // invalidate the link cache through waitUntil.
  const CLOUDFLARE_CONTEXT = Symbol.for("__cloudflare-context__");

  beforeAll(() => {
    if (!env.DATABASE_URL) Object.assign(env, { DATABASE_URL: testDatabaseUrl });
    Reflect.set(globalThis, CLOUDFLARE_CONTEXT, {
      env: {},
      cf: {},
      ctx: { waitUntil: () => {} },
    });
  });

  beforeEach(async () => {
    await cleanup();
    await db.insert(schema.user).values([
      { id: OWNER, email: "owner@reserved-alias.test" },
      { id: OTHER, email: "other@reserved-alias.test" },
    ]);
  });

  afterAll(cleanup);

  test("a single delete reserves the alias for every account, in any case", async () => {
    const id = await insertLink("tomb-single");
    await deleteLink(workspaceCtx(OWNER), { id });

    expect(await isAliasReserved(db, "TOMB-Single", "ishortn.ink")).toBe(true);
    await expectTaken("tomb-single");
    await expectTaken("Tomb-Single");
    expect(
      await checkPublicAliasAvailability(publicCtx, {
        alias: "tomb-single",
        domain: "ishortn.ink",
      }),
    ).toEqual({ isAvailable: false });

    // Reserved per domain: the same alias on another platform domain is untouched.
    expect(await isAliasReserved(db, "tomb-single", "isht.app")).toBe(false);
  });

  test("a bulk delete reserves every deleted alias", async () => {
    const ids = await Promise.all([
      insertLink("tomb-bulk-1"),
      insertLink("tomb-bulk-2", "isht.app"),
    ]);
    await bulkDeleteLinks(workspaceCtx(OWNER), ids);

    await expectTaken("tomb-bulk-1");
    await expectTaken("tomb-bulk-2", "isht.app");
  });

  test("deleting a QR code reserves its link's alias", async () => {
    const linkId = await insertLink("tomb-qr", "ishortn.ink", OWNER, true);
    const [qr] = await db.insert(schema.qrcode).values({
      userId: OWNER,
      linkId,
      contentType: "link",
      content: "https://example.com",
      patternStyle: "square",
      cornerStyle: "square",
      color: "#000000",
    });
    await deleteQrCode(workspaceCtx(OWNER), Number(qr.insertId));

    await expectTaken("tomb-qr");
  });

  test("an account purge reserves the account's aliases", async () => {
    await db
      .insert(schema.user)
      .values({ id: PURGED, email: "purged@reserved-alias.test", deletedAt: new Date(2020, 0, 1) });
    await insertLink("tomb-purged", "ishortn.ink", PURGED);

    const result = await cleanupDeletedAccounts(async () => {});
    expect(result.failures).toBe(0);

    const [row] = await db
      .select()
      .from(schema.reservedAlias)
      .where(inArray(schema.reservedAlias.alias, ["tomb-purged"]));
    expect(row?.reason).toBe("purged");
    await expectTaken("tomb-purged");
  });

  test("renaming a link reserves its old alias", async () => {
    const id = await insertLink("tomb-single");
    await updateLink(workspaceCtx(OWNER), { id, alias: "tomb-bulk-1" });

    await expectTaken("tomb-single");
  });

  test("moving a link onto a domain where its alias is reserved fails", async () => {
    await deleteLink(workspaceCtx(OWNER), { id: await insertLink("tomb-single") });
    const id = await insertLink("tomb-single", "isht.app");

    let error: unknown;
    try {
      await updateLink(workspaceCtx(OWNER), { id, domain: "ishortn.ink" });
    } catch (caught) {
      error = caught;
    }
    expect(error instanceof TRPCError && error.message).toBe(
      '"tomb-single" is already taken on ishortn.ink. Choose a different alias or domain.',
    );
  });

  test("custom-domain aliases stay reusable by the domain's owner", async () => {
    const id = await insertLink("tomb-single", CUSTOM_DOMAIN);
    await deleteLink(workspaceCtx(OWNER), { id });

    expect(await isAliasReserved(db, "tomb-single", CUSTOM_DOMAIN)).toBe(false);
    await checkAliasAvailability({ db }, "tomb-single", CUSTOM_DOMAIN);
  });

  test("random aliases skip reserved ones", async () => {
    const alias = await generateUnreservedAlias(db, "ishortn.ink");
    expect(await isAliasReserved(db, alias, "ishortn.ink")).toBe(false);
  });
});
