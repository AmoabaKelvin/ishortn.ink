import { afterAll, beforeEach, describe, expect, test } from "bun:test";

import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

import { buildWhatsAppUrl, parseWhatsApp, serializeWhatsApp } from "@/components/bio/whatsapp";
import * as schema from "@/server/db/schema";

import {
  getBioPage,
  getBioPageAnalytics,
  getPublicBioPageBySlug,
  updateBlock,
} from "./bio-page.service";
import { lockBioLinkBlockCapacity } from "./utils";

import type { PublicTRPCContext, WorkspaceTRPCContext } from "../../trpc";
import type { Plan } from "@/lib/billing/plans";

// Exercises the service against a real MySQL. Set TEST_DATABASE_URL to run it;
// see CONTRIBUTING.md, "Database tests".
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("bio page analytics (MySQL)", () => {
  const pool = mysql.createPool({ uri: testDatabaseUrl ?? "", connectionLimit: 5 });
  const db = drizzle(pool, { schema, mode: "default" });

  const USER_ID = "bio_analytics_test";
  const SLUG = "bio-analytics-service-test";
  // Backing link ids for the two link blocks, plus one link that isn't on the page.
  const LINK_A = 96_340_001;
  const LINK_B = 96_340_002;
  const FOREIGN_LINK = 96_340_099;
  const LINK_IDS = [LINK_A, LINK_B, FOREIGN_LINK];
  const DAY_MS = 24 * 60 * 60 * 1000;

  let pageId = 0;

  function ctx(plan: Plan) {
    // SAFETY: mirrors what workspaceProcedure resolves for a personal workspace.
    return {
      db,
      auth: { userId: USER_ID },
      workspace: {
        type: "personal",
        userId: USER_ID,
        teamId: null,
        teamSlug: null,
        role: "owner",
        plan,
      },
    } as WorkspaceTRPCContext;
  }

  async function cleanup() {
    await db.delete(schema.linkVisit).where(inArray(schema.linkVisit.linkId, LINK_IDS));
    const pages = await db.query.bioPage.findMany({ where: eq(schema.bioPage.userId, USER_ID) });
    const pageIds = pages.map((p) => p.id);
    if (pageIds.length) {
      await db.delete(schema.bioBlock).where(inArray(schema.bioBlock.bioPageId, pageIds));
      await db.delete(schema.bioPageView).where(inArray(schema.bioPageView.bioPageId, pageIds));
    }
    await db.delete(schema.bioPage).where(eq(schema.bioPage.userId, USER_ID));
    await db.delete(schema.user).where(eq(schema.user.id, USER_ID));
  }

  beforeEach(async () => {
    await cleanup();
    await db.insert(schema.user).values({ id: USER_ID });
    const [inserted] = await db.insert(schema.bioPage).values({ userId: USER_ID, slug: SLUG });
    pageId = Number(inserted.insertId);
    await db.insert(schema.bioBlock).values([
      { bioPageId: pageId, type: "link", title: "Shop", linkId: LINK_A, position: 0 },
      { bioPageId: pageId, type: "link", title: "Blog", linkId: LINK_B, position: 1 },
      { bioPageId: pageId, type: "heading", title: "Hello", position: 2 },
    ]);
  });

  afterAll(async () => {
    await cleanup();
    await pool.end();
  });

  test("empty range returns empty breakdowns", async () => {
    const result = await getBioPageAnalytics(ctx("pro"), { id: pageId, range: "7d" });

    expect(result.totalClicks).toBe(0);
    expect(result.views).toBe(0);
    expect(result.clickBreakdowns).toEqual({ countries: [], devices: [] });
    expect(result.viewReferrers).toEqual([]);
  });

  test("page without link blocks returns empty breakdowns", async () => {
    await db.delete(schema.bioBlock).where(eq(schema.bioBlock.bioPageId, pageId));

    const result = await getBioPageAnalytics(ctx("pro"), { id: pageId, range: "all" });

    expect(result.perBlock).toEqual([]);
    expect(result.clickBreakdowns).toEqual({ countries: [], devices: [] });
  });

  test("groups clicks across link blocks, with Unknown buckets", async () => {
    await db.insert(schema.linkVisit).values([
      { linkId: LINK_A, country: "Ghana", device: "mobile" },
      { linkId: LINK_A, country: "Ghana", device: "Mobile" },
      { linkId: LINK_A, country: "Ghana", device: "Desktop" },
      { linkId: LINK_B, country: "United States", device: "tablet" },
      { linkId: LINK_B, country: null, device: null },
      { linkId: LINK_B, country: "", device: "" },
      // Not on this page: must not count.
      { linkId: FOREIGN_LINK, country: "France", device: "Desktop" },
    ]);

    const result = await getBioPageAnalytics(ctx("pro"), { id: pageId, range: "7d" });
    const { countries, devices } = result.clickBreakdowns;

    expect(result.totalClicks).toBe(6);
    expect(countries).toEqual([
      { name: "Ghana", clicks: 3 },
      { name: "Unknown", clicks: 2 },
      { name: "United States", clicks: 1 },
    ]);
    expect(devices).toEqual([
      { name: "Mobile", clicks: 2 },
      { name: "Unknown", clicks: 2 },
      { name: "Desktop", clicks: 1 },
      { name: "Tablet", clicks: 1 },
    ]);
    for (const rows of [countries, devices]) {
      expect(rows.reduce((sum, r) => sum + r.clicks, 0)).toBe(result.totalClicks);
    }
  });

  test("groups page views by referrer host, with a Direct bucket", async () => {
    const [other] = await db.insert(schema.bioPage).values({ userId: USER_ID, slug: `${SLUG}-2` });
    await db.insert(schema.bioPageView).values([
      { bioPageId: pageId, referer: "instagram.com" },
      { bioPageId: pageId, referer: "https://l.instagram.com/?u=abc" },
      { bioPageId: pageId, referer: "direct" },
      { bioPageId: pageId, referer: null },
      { bioPageId: pageId, referer: "" },
      { bioPageId: pageId, referer: "twitter" },
      // Another page's view: must not count.
      { bioPageId: Number(other.insertId), referer: "google.com" },
    ]);

    const result = await getBioPageAnalytics(ctx("pro"), { id: pageId, range: "7d" });

    expect(result.views).toBe(6);
    expect(result.viewReferrers).toEqual([
      { name: "Direct", clicks: 3 },
      { name: "Instagram", clicks: 2 },
      { name: "X", clicks: 1 },
    ]);
  });

  test("leaves out views that recorded the app host as their referrer", async () => {
    await db.insert(schema.bioPageView).values([
      { bioPageId: pageId, referer: "ishortn.ink" },
      { bioPageId: pageId, referer: "ishortn.ink" },
      { bioPageId: pageId, referer: "instagram.com" },
      { bioPageId: pageId, referer: null },
    ]);

    const result = await getBioPageAnalytics(ctx("pro"), { id: pageId, range: "7d" });

    expect(result.views).toBe(4);
    expect(result.viewReferrers).toEqual([
      { name: "Direct", clicks: 1 },
      { name: "Instagram", clicks: 1 },
    ]);
  });

  test("views over time are zero-filled across the range", async () => {
    const now = Date.now();
    await db.insert(schema.bioPageView).values([
      { bioPageId: pageId, createdAt: new Date(now - 2 * DAY_MS) },
      { bioPageId: pageId, createdAt: new Date(now - 2 * DAY_MS) },
    ]);
    const day = (offset: number) => new Date(now - offset * DAY_MS).toISOString().slice(0, 10);

    const week = await getBioPageAnalytics(ctx("pro"), { id: pageId, range: "7d" });
    expect(week.viewsSeries.map((p) => p.date)).toEqual([7, 6, 5, 4, 3, 2, 1, 0].map(day));
    expect(week.viewsSeries.filter((p) => p.views > 0)).toEqual([{ date: day(2), views: 2 }]);

    // All time starts at the first day with views.
    const allTime = await getBioPageAnalytics(ctx("pro"), { id: pageId, range: "all" });
    expect(allTime.viewsSeries).toEqual([
      { date: day(2), views: 2 },
      { date: day(1), views: 0 },
      { date: day(0), views: 0 },
    ]);
  });

  test("breakdowns follow the selected range and the plan's history cap", async () => {
    const now = Date.now();
    await db.insert(schema.linkVisit).values([
      { linkId: LINK_A, country: "Ghana", device: "Mobile", createdAt: new Date(now - DAY_MS) },
      {
        linkId: LINK_B,
        country: "Kenya",
        device: "Desktop",
        createdAt: new Date(now - 20 * DAY_MS),
      },
      {
        linkId: LINK_B,
        country: "Kenya",
        device: "Desktop",
        createdAt: new Date(now - 200 * DAY_MS),
      },
    ]);

    await db.insert(schema.bioPageView).values([
      { bioPageId: pageId, referer: "instagram.com", createdAt: new Date(now - DAY_MS) },
      { bioPageId: pageId, referer: "tiktok.com", createdAt: new Date(now - 20 * DAY_MS) },
      { bioPageId: pageId, referer: "tiktok.com", createdAt: new Date(now - 200 * DAY_MS) },
    ]);

    const totalsFor = async (plan: Plan, range: "7d" | "30d" | "all") => {
      const result = await getBioPageAnalytics(ctx(plan), { id: pageId, range });
      const { countries } = result.clickBreakdowns;
      expect(countries.reduce((s, r) => s + r.clicks, 0)).toBe(result.totalClicks);
      expect(result.viewReferrers.reduce((s, r) => s + r.clicks, 0)).toBe(result.views);
      return { countries, referrers: result.viewReferrers };
    };

    const lastWeek = {
      countries: [{ name: "Ghana", clicks: 1 }],
      referrers: [{ name: "Instagram", clicks: 1 }],
    };
    expect(await totalsFor("pro", "7d")).toEqual(lastWeek);
    expect(await totalsFor("pro", "30d")).toEqual({
      countries: [
        { name: "Ghana", clicks: 1 },
        { name: "Kenya", clicks: 1 },
      ],
      referrers: [
        { name: "Instagram", clicks: 1 },
        { name: "tiktok.com", clicks: 1 },
      ],
    });
    expect(await totalsFor("pro", "all")).toEqual({
      countries: [
        { name: "Kenya", clicks: 2 },
        { name: "Ghana", clicks: 1 },
      ],
      referrers: [
        { name: "tiktok.com", clicks: 2 },
        { name: "Instagram", clicks: 1 },
      ],
    });
    // Free plans are capped at 7 days whatever range is requested.
    expect(await totalsFor("free", "all")).toEqual(lastWeek);
  });
});

describe.skipIf(!testDatabaseUrl)("bio page WhatsApp blocks (MySQL)", () => {
  const pool = mysql.createPool({ uri: testDatabaseUrl ?? "", connectionLimit: 5 });
  const db = drizzle(pool, { schema, mode: "default" });

  const USER_ID = "bio_whatsapp_test";
  const SLUG = "bio-whatsapp-service-test";
  const details = { phone: "+233241234567", message: "Hi! I'd like to order." };

  let pageId = 0;
  let blockId = 0;
  let linkId = 0;

  function ctx(plan: Plan) {
    // SAFETY: mirrors what workspaceProcedure resolves for a personal workspace.
    return {
      db,
      auth: { userId: USER_ID },
      workspace: {
        type: "personal",
        userId: USER_ID,
        teamId: null,
        teamSlug: null,
        role: "owner",
        plan,
      },
    } as WorkspaceTRPCContext;
  }

  async function cleanup() {
    const pages = await db.query.bioPage.findMany({ where: eq(schema.bioPage.userId, USER_ID) });
    const pageIds = pages.map((p) => p.id);
    if (pageIds.length) {
      await db.delete(schema.bioBlock).where(inArray(schema.bioBlock.bioPageId, pageIds));
    }
    await db.delete(schema.bioPage).where(eq(schema.bioPage.userId, USER_ID));
    await db.delete(schema.link).where(eq(schema.link.userId, USER_ID));
    await db.delete(schema.user).where(eq(schema.user.id, USER_ID));
  }

  beforeEach(async () => {
    await cleanup();
    await db.insert(schema.user).values({ id: USER_ID });
    const [page] = await db
      .insert(schema.bioPage)
      .values({ userId: USER_ID, slug: SLUG, isPublished: true });
    pageId = Number(page.insertId);
    const [backing] = await db.insert(schema.link).values({
      userId: USER_ID,
      url: buildWhatsAppUrl(details),
      alias: "biowa919",
      domain: "ishortn.ink",
      isBioLink: true,
    });
    linkId = Number(backing.insertId);
    // The shape addBlock stores for a WhatsApp block.
    const [block] = await db.insert(schema.bioBlock).values({
      bioPageId: pageId,
      type: "link",
      title: null,
      content: serializeWhatsApp(details),
      url: buildWhatsAppUrl(details),
      linkId,
      position: 0,
    });
    blockId = Number(block.insertId);
  });

  afterAll(async () => {
    await cleanup();
    await pool.end();
  });

  test("the editor gets a whatsapp block with its details", async () => {
    const page = await getBioPage(ctx("free"), pageId);

    expect(page.blocks).toHaveLength(1);
    expect(page.blocks[0]).toMatchObject({
      type: "whatsapp",
      whatsapp: details,
      shortUrl: "https://ishortn.ink/biowa919",
    });
  });

  test("the public page renders it through the tracked short link", async () => {
    // SAFETY: same database client as ctx() above; public reads only use db.
    const publicCtx = { db, headers: new Headers() } as PublicTRPCContext;
    const page = await getPublicBioPageBySlug(publicCtx, SLUG);

    expect(page?.blocks).toEqual([
      { id: blockId, type: "whatsapp", title: null, href: "https://ishortn.ink/biowa919" },
    ]);
  });

  test("counts toward the free plan's link-block cap", async () => {
    await db.insert(schema.bioBlock).values([
      { bioPageId: pageId, type: "link", title: "Shop", position: 1 },
      { bioPageId: pageId, type: "heading", title: "Hello", position: 2 },
    ]);
    // Two link-type blocks: one more fits.
    await db.transaction((tx) => lockBioLinkBlockCapacity(tx, "free", pageId, USER_ID));

    await db.insert(schema.bioBlock).values({
      bioPageId: pageId,
      type: "link",
      content: serializeWhatsApp(details),
      position: 3,
    });
    const atCap = db.transaction((tx) => lockBioLinkBlockCapacity(tx, "free", pageId, USER_ID));
    await expect(atCap).rejects.toThrow(/3 link blocks/);
    // Pro has no cap.
    await db.transaction((tx) => lockBioLinkBlockCapacity(tx, "pro", pageId, USER_ID));
  });

  test("editing the label keeps it a whatsapp block and ignores raw url/content", async () => {
    await updateBlock(ctx("free"), {
      id: blockId,
      title: "Order now",
      content: "overwritten",
      url: null,
    });

    const row = await db.query.bioBlock.findFirst({ where: eq(schema.bioBlock.id, blockId) });
    expect(row?.title).toBe("Order now");
    expect(parseWhatsApp(row?.content ?? null)).toEqual(details);
    expect(row?.url).toBe(buildWhatsAppUrl(details));
  });

  test("a plain link block's content can't be set to WhatsApp details", async () => {
    const [plain] = await db
      .insert(schema.bioBlock)
      .values({ bioPageId: pageId, type: "link", title: "Shop", position: 1 });
    const id = Number(plain.insertId);

    await updateBlock(ctx("free"), { id, content: serializeWhatsApp(details) });

    const row = await db.query.bioBlock.findFirst({ where: eq(schema.bioBlock.id, id) });
    expect(row?.content).toBeNull();
  });
});
