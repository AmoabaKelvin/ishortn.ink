import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { eq, inArray } from "drizzle-orm";

import { env } from "@/env.mjs";
import { resetLinkStatistics, toggleLinkStatus } from "@/server/api/routers/link/link.service";
import { resetQrCodeStatistics } from "@/server/api/routers/qrcode/qrcode.service";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";

import { resolveShortLink } from "./resolve-link";

import type { WorkspaceTRPCContext } from "@/server/api/trpc";

// Runs against a disposable MySQL with the schema pushed (test/setup.ts points
// the app's db client at it); see CONTRIBUTING.md, "Database tests".
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("click limits (MySQL)", () => {
  const USER_ID = "resolve_link_click_limit_test";
  const DOMAIN = "ishortn.ink";
  const BASE_URL = "https://ishortn.ink";
  const DESTINATION = "https://example.com/limited";
  const FREE_EVENTS_LIMIT = 1000;
  // OpenNext reads the request context from this global. Without KV or a queue
  // binding the cache misses and clicks are ingested inline in the background
  // task, which waitUntil collects so each test can wait for it.
  const CLOUDFLARE_CONTEXT = Symbol.for("__cloudflare-context__");
  let pending: Promise<unknown>[] = [];

  // SAFETY: mirrors what workspaceProcedure resolves for a personal free workspace;
  // the reset and toggle services read only db and workspace.
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
      plan: "free",
    },
  } as WorkspaceTRPCContext;

  beforeAll(() => {
    // Another test file replaces @/env.mjs with a partial object for the whole
    // run, dropping DATABASE_URL; the app's db client reads it on first use.
    if (!env.DATABASE_URL) Object.assign(env, { DATABASE_URL: testDatabaseUrl });
    Reflect.set(globalThis, CLOUDFLARE_CONTEXT, {
      env: {},
      cf: {},
      ctx: { waitUntil: (promise: Promise<unknown>) => pending.push(promise) },
    });
  });

  async function cleanup() {
    const links = await db
      .select({ id: schema.link.id })
      .from(schema.link)
      .where(eq(schema.link.userId, USER_ID));
    if (links.length) {
      const ids = links.map((l) => l.id);
      await db.delete(schema.linkVisit).where(inArray(schema.linkVisit.linkId, ids));
      await db.delete(schema.uniqueLinkVisit).where(inArray(schema.uniqueLinkVisit.linkId, ids));
    }
    await db.delete(schema.qrcode).where(eq(schema.qrcode.userId, USER_ID));
    await db.delete(schema.link).where(eq(schema.link.userId, USER_ID));
    await db.delete(schema.user).where(eq(schema.user.id, USER_ID));
  }

  beforeEach(async () => {
    pending = [];
    await cleanup();
    // A Free account that has used its whole monthly event allowance.
    await db.insert(schema.user).values({
      id: USER_ID,
      email: `${USER_ID}@example.com`,
      monthlyEventCount: FREE_EVENTS_LIMIT,
      lastEventCountReset: new Date(),
    });
  });

  afterAll(async () => {
    Reflect.deleteProperty(globalThis, CLOUDFLARE_CONTEXT);
    await cleanup();
  });

  async function createLink(alias: string, disableLinkAfterClicks: number | null) {
    const [inserted] = await db.insert(schema.link).values({
      userId: USER_ID,
      url: DESTINATION,
      alias,
      domain: DOMAIN,
      disableLinkAfterClicks,
    });
    return inserted.insertId;
  }

  async function visit(alias: string) {
    const resolution = await resolveShortLink({
      domain: DOMAIN,
      alias,
      country: "US",
      city: "New York",
      ip: "203.0.113.7",
      headers: new Headers({
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      }),
      baseUrl: BASE_URL,
    });
    await Promise.all(pending);
    pending = [];
    return resolution?.url;
  }

  async function storedLink(id: number) {
    return db.query.link.findFirst({ where: eq(schema.link.id, id) });
  }

  test("clicks dropped by the event cap still close a link at its click limit", async () => {
    const id = await createLink("limit-dropped", 3);

    for (let i = 0; i < 3; i++) {
      expect(await visit("limit-dropped")).toBe(DESTINATION);
    }

    const recorded = await db
      .select({ id: schema.linkVisit.id })
      .from(schema.linkVisit)
      .where(eq(schema.linkVisit.linkId, id));
    expect(recorded).toHaveLength(0);
    const owner = await db.query.user.findFirst({ where: eq(schema.user.id, USER_ID) });
    expect(owner?.droppedEventCount).toBe(3);
    expect((await storedLink(id))?.clickLimitCount).toBe(3);

    expect(await visit("limit-dropped")).toBe(`${BASE_URL}/expired/${id}`);
    expect((await storedLink(id))?.disabled).toBe(true);
  });

  test("a link's counter starts from the clicks it had already recorded", async () => {
    const id = await createLink("limit-existing", 3);
    const recorded = {
      linkId: id,
      device: "Desktop",
      browser: "Chrome",
      os: "macOS",
      country: "Ghana",
      city: "Accra",
    };
    await db.insert(schema.linkVisit).values([recorded, recorded]);

    expect(await visit("limit-existing")).toBe(DESTINATION);
    expect((await storedLink(id))?.clickLimitCount).toBe(3);
    expect(await visit("limit-existing")).toBe(`${BASE_URL}/expired/${id}`);
  });

  test("links without a click limit keep no counter", async () => {
    const id = await createLink("no-limit", null);

    for (let i = 0; i < 2; i++) {
      expect(await visit("no-limit")).toBe(DESTINATION);
    }

    expect((await storedLink(id))?.clickLimitCount).toBeNull();
  });

  async function exhaustLimit(alias: string, id: number) {
    for (let i = 0; i < 3; i++) await visit(alias);
    expect(await visit(alias)).toBe(`${BASE_URL}/expired/${id}`);
    expect((await storedLink(id))?.disabled).toBe(true);
  }

  test("resetting a link's statistics restarts its click limit", async () => {
    const id = await createLink("limit-reset", 3);
    await exhaustLimit("limit-reset", id);

    await resetLinkStatistics(ctx, { id });
    expect((await storedLink(id))?.clickLimitCount).toBeNull();
    await toggleLinkStatus(ctx, { id });

    expect(await visit("limit-reset")).toBe(DESTINATION);
    expect((await storedLink(id))?.clickLimitCount).toBe(1);
  });

  test("resetting a QR code's statistics restarts its link's click limit", async () => {
    const id = await createLink("limit-qr-reset", 3);
    const [qr] = await db.insert(schema.qrcode).values({
      userId: USER_ID,
      linkId: id,
      contentType: "link",
      content: DESTINATION,
      patternStyle: "square",
      cornerStyle: "square",
      color: "#000000",
    });
    await exhaustLimit("limit-qr-reset", id);

    await resetQrCodeStatistics(ctx, qr.insertId);
    expect((await storedLink(id))?.clickLimitCount).toBeNull();
    await toggleLinkStatus(ctx, { id });

    expect(await visit("limit-qr-reset")).toBe(DESTINATION);
    expect((await storedLink(id))?.clickLimitCount).toBe(1);
  });
});
