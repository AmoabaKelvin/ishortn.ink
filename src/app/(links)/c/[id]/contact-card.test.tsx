import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { eq } from "drizzle-orm";
import { renderToStaticMarkup } from "react-dom/server";

import { env } from "@/env.mjs";
import {
  createVCardQrCode,
  updateQrCode,
  updateVCardQrCode,
} from "@/server/api/routers/qrcode/qrcode.service";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { getContactCard } from "@/server/lib/contact-card";

import { ContactCardView } from "./contact-card-view";
import { GET } from "./vcf/route";

import type { VCardPayload } from "@/lib/qr-generator/vcard";
import type { WorkspaceTRPCContext } from "@/server/api/trpc";

// Runs against a disposable MySQL with the schema pushed; see CONTRIBUTING.md, "Database tests".
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("vCard QR codes and their contact page (MySQL)", () => {
  const USER_ID = "vcard_contact_page_test";
  const CLOUDFLARE_CONTEXT = Symbol.for("__cloudflare-context__");

  const contextFor = (plan: "free" | "pro") =>
    // SAFETY: the services under test read only db, auth.userId, restrictedAt and the personal
    // workspace fields set here.
    ({
      db,
      auth: { userId: USER_ID },
      restrictedAt: null,
      workspace: {
        type: "personal",
        userId: USER_ID,
        teamId: null,
        teamSlug: null,
        role: "owner",
        plan,
      },
    }) as WorkspaceTRPCContext;

  // No website, so creating the code needs no URL safety lookups.
  const card: VCardPayload = {
    type: "vcard",
    firstName: "José",
    lastName: "Ñúñez",
    organization: "Acme, Inc.",
    jobTitle: "Head of Sales",
    phone: "+1 415 555 0100",
    phone2: "",
    email: "jose@example.com",
    website: "",
    address: "",
    note: "",
  };

  const create = () =>
    createVCardQrCode(contextFor("pro"), {
      title: "Business card",
      patternStyle: "square",
      cornerStyle: "square",
      selectedColor: "#000000",
      domain: "ishortn.ink",
      card,
    });

  async function savedCode(id: number) {
    const qr = await db.query.qrcode.findFirst({
      where: eq(schema.qrcode.id, id),
      with: { link: true },
    });
    if (!qr?.publicId || !qr.link) throw new Error("vCard code was not saved with its link");
    return { ...qr, publicId: qr.publicId, link: qr.link };
  }

  const download = (publicId: string) =>
    GET(new Request(`http://localhost/c/${publicId}/vcf`), {
      params: Promise.resolve({ id: publicId }),
    });

  async function cleanup() {
    await db.delete(schema.qrcode).where(eq(schema.qrcode.userId, USER_ID));
    await db.delete(schema.link).where(eq(schema.link.userId, USER_ID));
    await db.delete(schema.user).where(eq(schema.user.id, USER_ID));
  }

  beforeAll(() => {
    // Another test file replaces @/env.mjs with a partial object for the whole run; the page URL
    // comes from NEXT_PUBLIC_APP_URL (pinned in test/setup.ts).
    if (!env.DATABASE_URL) Object.assign(env, { DATABASE_URL: testDatabaseUrl });
    if (!env.NEXT_PUBLIC_APP_URL) {
      Object.assign(env, { NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL });
    }
    Reflect.set(globalThis, CLOUDFLARE_CONTEXT, {
      env: {},
      cf: {},
      ctx: { waitUntil: () => {} },
    });
  });

  beforeEach(async () => {
    await cleanup();
    await db.insert(schema.user).values({ id: USER_ID, email: "vcard@example.test" });
  });

  afterAll(async () => {
    Reflect.deleteProperty(globalThis, CLOUDFLARE_CONTEXT);
    await cleanup();
  });

  test("creates a short link to the hosted contact page", async () => {
    const { id, trackingUrl } = await create();
    const qr = await savedCode(id);

    expect(qr.payloadType).toBe("vcard");
    expect(qr.contentType).toBe("link");
    expect(qr.publicId).toMatch(/^[\w-]{12}$/);
    expect(qr.link.isQrCode).toBe(true);
    expect(qr.link.url).toBe(`https://ishortn.ink/c/${qr.publicId}`);
    expect(trackingUrl).toBe(`https://ishortn.ink/${qr.link.alias}`);
  });

  test("is a Pro and Ultra feature", async () => {
    const attempt = createVCardQrCode(contextFor("free"), {
      patternStyle: "square",
      cornerStyle: "square",
      selectedColor: "#000000",
      card,
    });
    await expect(attempt).rejects.toThrow("available on Pro and Ultra");
  });

  test("/c/<id> renders the card", async () => {
    const qr = await savedCode((await create()).id);

    // What the page renders; page.tsx only adds the font, which needs the Next build.
    const saved = await getContactCard(qr.publicId);
    expect(saved).not.toBeNull();
    const html = renderToStaticMarkup(<ContactCardView publicId={qr.publicId} card={saved!} />);

    expect(html).toContain("José Ñúñez");
    expect(html).toContain("Head of Sales · Acme, Inc.");
    expect(html).toContain('href="tel:+14155550100"');
    expect(html).toContain('href="mailto:jose@example.com"');
    expect(html).toContain(`href="/c/${qr.publicId}/vcf"`);
    expect(html).toContain("Save contact");
  });

  test("/c/<id>/vcf downloads the card as a UTF-8 vCard", async () => {
    const qr = await savedCode((await create()).id);

    const response = await download(qr.publicId);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/vcard; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toBe(
      `attachment; filename="contact.vcf"; filename*=UTF-8''${encodeURIComponent("José Ñúñez.vcf")}`,
    );
    const vcf = await response.text();
    expect(vcf.startsWith("BEGIN:VCARD\r\nVERSION:3.0\r\n")).toBe(true);
    expect(vcf).toContain("\r\nFN:José Ñúñez\r\n");
    expect(vcf).toContain("\r\nORG:Acme\\, Inc.\r\n");
  });

  test("editing the card changes the .vcf, not the short link", async () => {
    const before = await savedCode((await create()).id);

    await updateVCardQrCode(contextFor("pro"), {
      id: before.id,
      card: { ...card, phone: "+44 20 7946 0000", jobTitle: "Sales Director" },
    });

    const after = await savedCode(before.id);
    expect(after.link.alias).toBe(before.link.alias);
    expect(after.link.url).toBe(before.link.url);
    const vcf = await (await download(after.publicId)).text();
    expect(vcf).toContain("\r\nTEL;TYPE=VOICE:+44 20 7946 0000\r\n");
    expect(vcf).toContain("\r\nTITLE:Sales Director\r\n");
    expect(vcf).not.toContain("+1 415 555 0100");
  });

  test("keeps the link pointed at its contact page", async () => {
    const qr = await savedCode((await create()).id);

    await expect(
      updateQrCode(contextFor("pro"), { id: qr.id, url: "https://example.com" }),
    ).rejects.toThrow("can't be changed");
  });

  test("the page and the .vcf go down with a deactivated link", async () => {
    const qr = await savedCode((await create()).id);
    await db.update(schema.link).set({ disabled: true }).where(eq(schema.link.id, qr.link.id));

    expect((await download(qr.publicId)).status).toBe(404);
    expect((await download("not-a-real-id")).status).toBe(404);
  });
});
