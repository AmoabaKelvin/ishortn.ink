import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { TRPCError } from "@trpc/server";
import { eq, inArray } from "drizzle-orm";

import { env } from "@/env.mjs";
import { deleteLink } from "@/server/api/routers/link/link.service";
import { deleteQrCode, resetQrCodeStatistics } from "@/server/api/routers/qrcode/qrcode.service";
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
    await db.delete(schema.link).where(eq(schema.link.userId, USER_ID));
    await db.delete(schema.reservedAlias).where(eq(schema.reservedAlias.alias, "import-qr"));
    await db.delete(schema.user).where(eq(schema.user.id, USER_ID));
  }

  async function importedLinkWithQrCode() {
    const [inserted] = await db.insert(schema.link).values({
      userId: USER_ID,
      url: "https://example.com",
      alias: "import-qr",
      domain: "ishortn.ink",
    });
    const linkId = Number(inserted.insertId);
    const [qr] = await db.insert(schema.qrcode).values({
      userId: USER_ID,
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
});
