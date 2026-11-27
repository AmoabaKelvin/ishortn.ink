import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { TRPCError } from "@trpc/server";
import { eq, inArray } from "drizzle-orm";

import { env } from "@/env.mjs";
import { deleteLink } from "@/server/api/routers/link/link.service";
import {
  deleteQrCode,
  getQrCode,
  resetQrCodeStatistics,
  retrieveUserQrCodes,
  toggleQrCodeStatus,
} from "@/server/api/routers/qrcode/qrcode.service";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";

import type { WorkspaceTRPCContext } from "@/server/api/trpc";

// QR codes made by a CSV import encode one of the workspace's visible links rather than a hidden
// tracking link of their own. Runs against a disposable MySQL with the schema pushed; see
// CONTRIBUTING.md, "Database tests".
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("QR codes made by a CSV import (MySQL)", () => {
  const USER_ID = "import_qr_codes_test";
  const CLOUDFLARE_CONTEXT = Symbol.for("__cloudflare-context__");

  // SAFETY: the services under test read only db, auth.userId, restrictedAt and the personal
  // workspace fields set here.
  const ctx = {
    db,
    auth: { userId: USER_ID },
    restrictedAt: null,
    workspace: {
      type: "personal",
      userId: USER_ID,
      teamId: null,
      teamSlug: null,
      role: "owner",
      plan: "pro",
    },
  } as WorkspaceTRPCContext;

  async function cleanup() {
    const links = await db
      .select({ id: schema.link.id })
      .from(schema.link)
      .where(eq(schema.link.userId, USER_ID));
    if (links.length) {
      const ids = links.map((l) => l.id);
      await db.delete(schema.linkVisit).where(inArray(schema.linkVisit.linkId, ids));
    }
    await db.delete(schema.qrcode).where(eq(schema.qrcode.userId, USER_ID));
    await db.delete(schema.folder).where(eq(schema.folder.userId, USER_ID));
    await db.delete(schema.link).where(eq(schema.link.userId, USER_ID));
    await db.delete(schema.reservedAlias).where(eq(schema.reservedAlias.alias, "import-qr"));
    await db.delete(schema.user).where(eq(schema.user.id, USER_ID));
  }

  async function importedLinkWithQrCode(owner: { teamId?: number; folderId?: number } = {}) {
    const [inserted] = await db.insert(schema.link).values({
      userId: USER_ID,
      teamId: owner.teamId ?? null,
      folderId: owner.folderId ?? null,
      url: "https://example.com",
      alias: "import-qr",
      domain: "ishortn.ink",
    });
    const linkId = Number(inserted.insertId);
    const [qr] = await db.insert(schema.qrcode).values({
      userId: USER_ID,
      teamId: owner.teamId ?? null,
      linkId,
      contentType: "link",
      content: "https://example.com",
      patternStyle: "square",
      cornerStyle: "square",
      color: "#000000",
    });
    await db.insert(schema.linkVisit).values({ linkId, device: "desktop" });
    return { linkId, qrCodeId: Number(qr.insertId) };
  }

  const qrCodesOf = (linkId: number) =>
    db.select().from(schema.qrcode).where(eq(schema.qrcode.linkId, linkId));
  const visitsOf = (linkId: number) =>
    db.select().from(schema.linkVisit).where(eq(schema.linkVisit.linkId, linkId));

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
    await db.insert(schema.user).values({ id: USER_ID, email: "import-qr@example.test" });
  });

  afterAll(async () => {
    Reflect.deleteProperty(globalThis, CLOUDFLARE_CONTEXT);
    await cleanup();
  });

  test("deleting the link deletes its QR codes", async () => {
    const { linkId } = await importedLinkWithQrCode();

    await deleteLink(ctx, { id: linkId });

    expect(await qrCodesOf(linkId)).toEqual([]);
  });

  test("deleting the QR code keeps the link and its clicks", async () => {
    const { linkId, qrCodeId } = await importedLinkWithQrCode();

    await deleteQrCode(ctx, qrCodeId);

    expect(await qrCodesOf(linkId)).toEqual([]);
    const [kept] = await db.select().from(schema.link).where(eq(schema.link.id, linkId));
    expect(kept?.id).toBe(linkId);
    expect(await visitsOf(linkId)).toHaveLength(1);
  });

  test("resetting the QR code's statistics is refused and the link's clicks stay", async () => {
    const { linkId, qrCodeId } = await importedLinkWithQrCode();

    let error: unknown;
    try {
      await resetQrCodeStatistics(ctx, qrCodeId);
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(TRPCError);
    expect(error instanceof TRPCError && error.code).toBe("BAD_REQUEST");
    expect(await visitsOf(linkId)).toHaveLength(1);
  });

  describe("in a restricted team folder", () => {
    const TEAM_ID = 940_940;
    // SAFETY: as above, with a team member's workspace fields.
    const memberCtx = {
      db,
      auth: { userId: "import_qr_codes_member" },
      restrictedAt: null,
      workspace: {
        type: "team",
        userId: "import_qr_codes_member",
        teamId: TEAM_ID,
        teamSlug: "import-qr",
        role: "member",
        plan: "ultra",
      },
    } as WorkspaceTRPCContext;

    async function restrictedFolderCode() {
      const [folder] = await db
        .insert(schema.folder)
        .values({ name: "Restricted", userId: USER_ID, teamId: TEAM_ID, isRestricted: true });
      return importedLinkWithQrCode({ teamId: TEAM_ID, folderId: Number(folder.insertId) });
    }

    async function trpcErrorOf(run: () => Promise<void>): Promise<TRPCError | undefined> {
      try {
        await run();
      } catch (caught) {
        if (caught instanceof TRPCError) return caught;
        throw caught;
      }
      return undefined;
    }

    test("is hidden from a member without access", async () => {
      const { qrCodeId } = await restrictedFolderCode();

      const listed = await retrieveUserQrCodes(memberCtx);

      expect(listed.map((qr) => qr.id)).not.toContain(qrCodeId);
    });

    test("cannot be read, deactivated or deleted by a member without access", async () => {
      const { linkId, qrCodeId } = await restrictedFolderCode();

      for (const run of [
        async () => void (await getQrCode(memberCtx, qrCodeId)),
        async () => void (await toggleQrCodeStatus(memberCtx, qrCodeId)),
        async () => void (await deleteQrCode(memberCtx, qrCodeId)),
      ]) {
        expect((await trpcErrorOf(run))?.code).toBe("FORBIDDEN");
      }

      const [kept] = await db.select().from(schema.link).where(eq(schema.link.id, linkId));
      expect(kept?.disabled).toBe(false);
      expect(await qrCodesOf(linkId)).toHaveLength(1);
    });

    test("stays available to a team admin", async () => {
      const { qrCodeId } = await restrictedFolderCode();
      // SAFETY: same fields as memberCtx; admins bypass folder restrictions.
      const adminCtx = {
        ...memberCtx,
        workspace: { ...memberCtx.workspace, role: "admin" },
      } as WorkspaceTRPCContext;

      const listed = await retrieveUserQrCodes(adminCtx);

      expect(listed.map((qr) => qr.id)).toContain(qrCodeId);
      expect((await getQrCode(adminCtx, qrCodeId)).id).toBe(qrCodeId);
    });
  });
});
