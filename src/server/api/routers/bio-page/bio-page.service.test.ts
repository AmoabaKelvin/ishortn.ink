import { afterAll, afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";

import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

import { EMBED_UNSUPPORTED_MESSAGE } from "@/components/bio/embed";
import { parseEmbed } from "@/components/bio/embed-content";
import { buildWhatsAppUrl, parseWhatsApp, serializeWhatsApp } from "@/components/bio/whatsapp";
import * as platform from "@/lib/platform";
import * as schema from "@/server/db/schema";
import { clearPlanLimitHitMemo } from "@/server/lib/plan-limit-hits";

import { addBioBlockSchema } from "./bio-page.input";
import {
  addBlock,
  deleteBlock,
  getBioPage,
  getBioPageAnalytics,
  getPublicBioPageBySlug,
  updateBlock,
} from "./bio-page.service";
import { lockBioBlockCapacity } from "./utils";

import type { PublicTRPCContext, WorkspaceTRPCContext } from "../../trpc";
import type { Plan } from "@/lib/billing/plans";
import type { z } from "zod";

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
  let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, "fetch">>;

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
    const links = await db.query.link.findMany({ where: eq(schema.link.userId, USER_ID) });
    if (links.length) {
      const linkIds = links.map((l) => l.id);
      await db
        .delete(schema.linkSafetyRecheck)
        .where(inArray(schema.linkSafetyRecheck.linkId, linkIds));
    }
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
    // addBlock runs the URL safety check; keep it off the network. It fails open, so the add
    // goes through and leaves a recheck row for the re-scan.
    fetchSpy = spyOn(globalThis, "fetch").mockRejectedValue(new Error("no network in tests"));
  });

  afterEach(() => {
    fetchSpy.mockRestore();
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
    await db.transaction((tx) => lockBioBlockCapacity(tx, "free", pageId, USER_ID, "link"));

    await db.insert(schema.bioBlock).values({
      bioPageId: pageId,
      type: "link",
      content: serializeWhatsApp(details),
      position: 3,
    });
    const atCap = db.transaction((tx) => lockBioBlockCapacity(tx, "free", pageId, USER_ID, "link"));
    await expect(atCap).rejects.toThrow(/3 link blocks/);
    // Pro has no cap.
    await db.transaction((tx) => lockBioBlockCapacity(tx, "pro", pageId, USER_ID, "link"));
  });

  test("addBlock stores a whatsapp block behind a hidden link to wa.me", async () => {
    const input = addBioBlockSchema.parse({
      bioPageId: pageId,
      type: "whatsapp",
      whatsapp: { phone: "+44 7700 900123", message: "Table for 2?" },
    });
    const { id } = await addBlock(ctx("free"), input);

    const row = await db.query.bioBlock.findFirst({ where: eq(schema.bioBlock.id, id) });
    const stored = { phone: "+447700900123", message: "Table for 2?" };
    expect(row).toMatchObject({
      type: "link",
      content: serializeWhatsApp(stored),
      url: "https://wa.me/447700900123?text=Table%20for%202%3F",
      position: 1,
    });
    const backing = await db.query.link.findFirst({
      where: eq(schema.link.id, row?.linkId ?? 0),
    });
    expect(backing).toMatchObject({
      url: "https://wa.me/447700900123?text=Table%20for%202%3F",
      userId: USER_ID,
      isBioLink: true,
    });
  });

  test("addBlock rejects a whatsapp block without details", async () => {
    const input = addBioBlockSchema.parse({ bioPageId: pageId, type: "whatsapp" });
    const add = addBlock(ctx("free"), input);

    await expect(add).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "A WhatsApp block needs a phone number.",
    });
  });

  test("addBlock rejects a fourth link block on the free plan", async () => {
    await db.insert(schema.bioBlock).values([
      { bioPageId: pageId, type: "link", title: "Shop", position: 1 },
      { bioPageId: pageId, type: "link", title: "Blog", position: 2 },
    ]);

    const input = addBioBlockSchema.parse({
      bioPageId: pageId,
      type: "whatsapp",
      whatsapp: details,
    });
    const add = addBlock(ctx("free"), input);

    await expect(add).rejects.toThrow(/3 link blocks/);
    const blocks = await db.query.bioBlock.findMany({
      where: eq(schema.bioBlock.bioPageId, pageId),
    });
    expect(blocks).toHaveLength(3);
    // The hidden link is rolled back with the block.
    const links = await db.query.link.findMany({ where: eq(schema.link.userId, USER_ID) });
    expect(links.map((l) => l.id)).toEqual([linkId]);
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

describe.skipIf(!testDatabaseUrl)("bio page embed and image blocks (MySQL)", () => {
  const pool = mysql.createPool({ uri: testDatabaseUrl ?? "", connectionLimit: 5 });
  const db = drizzle(pool, { schema, mode: "default" });

  const USER_ID = "bio_embed_image_test";
  const SLUG = "bio-embed-image-service-test";
  const YOUTUBE = "https://youtu.be/dQw4w9WgXcQ";
  const PNG =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

  let pageId = 0;
  let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, "fetch">>;
  let afterResponseSpy: ReturnType<typeof spyOn<typeof platform, "runAfterResponse">>;

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

  const add = (plan: Plan, input: Omit<z.input<typeof addBioBlockSchema>, "bioPageId">) =>
    addBlock(ctx(plan), addBioBlockSchema.parse({ bioPageId: pageId, ...input }));

  const blocksOnPage = () =>
    db.query.bioBlock.findMany({
      where: eq(schema.bioBlock.bioPageId, pageId),
      orderBy: (t, { asc }) => [asc(t.position)],
    });

  async function cleanup() {
    const pages = await db.query.bioPage.findMany({ where: eq(schema.bioPage.userId, USER_ID) });
    const pageIds = pages.map((p) => p.id);
    if (pageIds.length) {
      await db.delete(schema.bioBlock).where(inArray(schema.bioBlock.bioPageId, pageIds));
    }
    await db.delete(schema.bioPage).where(eq(schema.bioPage.userId, USER_ID));
    const links = await db.query.link.findMany({ where: eq(schema.link.userId, USER_ID) });
    if (links.length) {
      await db.delete(schema.linkSafetyRecheck).where(
        inArray(
          schema.linkSafetyRecheck.linkId,
          links.map((l) => l.id),
        ),
      );
    }
    await db.delete(schema.link).where(eq(schema.link.userId, USER_ID));
    await db.delete(schema.planLimitHit).where(eq(schema.planLimitHit.userId, USER_ID));
    await db.delete(schema.user).where(eq(schema.user.id, USER_ID));
  }

  beforeEach(async () => {
    await cleanup();
    clearPlanLimitHitMemo();
    await db.insert(schema.user).values({ id: USER_ID });
    const [page] = await db
      .insert(schema.bioPage)
      .values({ userId: USER_ID, slug: SLUG, isPublished: true });
    pageId = Number(page.insertId);
    // Keeps the oEmbed title lookup and the URL safety check off the network; both fail open.
    fetchSpy = spyOn(globalThis, "fetch").mockRejectedValue(new Error("no network in tests"));
    // Removing a hidden link purges its redirect cache after the response, which
    // needs the Workers request context.
    afterResponseSpy = spyOn(platform, "runAfterResponse").mockImplementation(() => {});
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    afterResponseSpy.mockRestore();
  });

  afterAll(async () => {
    await cleanup();
    await pool.end();
  });

  test("a free page takes one YouTube embed, stored as its canonical URL and id", async () => {
    await add("free", { type: "embed", url: YOUTUBE });

    const [row] = await blocksOnPage();
    expect(row).toMatchObject({
      type: "embed",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      linkId: null,
    });
    expect(parseEmbed(row?.content ?? null)).toEqual({
      provider: "youtube",
      embedId: "dQw4w9WgXcQ",
      title: undefined,
    });
  });

  test("a second embed on a free page is refused with an upgrade message and logged", async () => {
    await add("free", { type: "embed", url: YOUTUBE });

    await expect(
      add("free", { type: "embed", url: "https://vimeo.com/76979871" }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message:
        "The free plan allows 1 embed block per bio page. Upgrade to Pro for unlimited embeds.",
    });
    expect(await blocksOnPage()).toHaveLength(1);
    const hits = await db.query.planLimitHit.findMany({
      where: eq(schema.planLimitHit.userId, USER_ID),
    });
    expect(hits.map((h) => h.limitKey)).toEqual(["bio_embed_blocks"]);
  });

  test("embeds don't count toward the free link-block cap, or the reverse", async () => {
    await db
      .insert(schema.bioBlock)
      .values(
        [0, 1, 2].map((position) => ({ bioPageId: pageId, type: "link" as const, position })),
      );

    await add("free", { type: "embed", url: YOUTUBE });

    expect(await blocksOnPage()).toHaveLength(4);
  });

  test("Pro pages take several embeds", async () => {
    await add("pro", { type: "embed", url: YOUTUBE });
    await add("pro", {
      type: "embed",
      url: "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT",
    });
    await add("pro", { type: "embed", url: "https://www.google.com/maps?q=Accra+Mall" });

    expect((await blocksOnPage()).map((b) => b.type)).toEqual(["embed", "embed", "embed"]);
  });

  test("unsupported and malformed embed URLs are rejected with the parser's message", async () => {
    await expect(
      add("pro", { type: "embed", url: "https://example.com/video" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: EMBED_UNSUPPORTED_MESSAGE });
    await expect(add("pro", { type: "embed", url: "not a url" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(await blocksOnPage()).toHaveLength(0);
  });

  test("the oEmbed title is stored when the provider answers", async () => {
    fetchSpy.mockImplementation(async (input) =>
      String(input).startsWith("https://www.youtube.com/oembed")
        ? Response.json({ title: "Never Gonna Give You Up" })
        : Promise.reject(new Error("no network in tests")),
    );

    await add("free", { type: "embed", url: YOUTUBE });

    const [row] = await blocksOnPage();
    expect(parseEmbed(row?.content ?? null)?.title).toBe("Never Gonna Give You Up");
  });

  test("changing an embed's URL re-parses it, and a bad URL leaves it unchanged", async () => {
    const { id } = await add("pro", { type: "embed", url: YOUTUBE });

    await updateBlock(ctx("pro"), { id, url: "https://vimeo.com/76979871" });
    let row = await db.query.bioBlock.findFirst({ where: eq(schema.bioBlock.id, id) });
    expect(row?.url).toBe("https://vimeo.com/76979871");
    expect(parseEmbed(row?.content ?? null)?.provider).toBe("vimeo");

    await expect(updateBlock(ctx("pro"), { id, url: "https://evil.example" })).rejects.toThrow(
      EMBED_UNSUPPORTED_MESSAGE,
    );
    row = await db.query.bioBlock.findFirst({ where: eq(schema.bioBlock.id, id) });
    expect(row?.url).toBe("https://vimeo.com/76979871");
  });

  test("image blocks are refused on the free plan and logged", async () => {
    await expect(add("free", { type: "image", image: PNG })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Image blocks are available on Pro and Ultra plans.",
    });
    expect(await blocksOnPage()).toHaveLength(0);
    const hits = await db.query.planLimitHit.findMany({
      where: eq(schema.planLimitHit.userId, USER_ID),
    });
    expect(hits.map((h) => h.limitKey)).toEqual(["bio_image_blocks"]);
  });

  test("a linked image goes through a hidden tracking link on the public page", async () => {
    const { id } = await add("pro", {
      type: "image",
      image: PNG,
      title: "Spring menu",
      url: "https://example.com/menu",
    });

    const row = await db.query.bioBlock.findFirst({ where: eq(schema.bioBlock.id, id) });
    expect(row).toMatchObject({ type: "image", title: "Spring menu", content: PNG });
    const backing = await db.query.link.findFirst({ where: eq(schema.link.id, row?.linkId ?? 0) });
    expect(backing).toMatchObject({ url: "https://example.com/menu", isBioLink: true });

    // SAFETY: same database client as ctx() above; public reads only use db.
    const publicCtx = { db, headers: new Headers() } as PublicTRPCContext;
    const page = await getPublicBioPageBySlug(publicCtx, SLUG);
    expect(page?.blocks).toEqual([
      {
        id,
        type: "image",
        src: PNG,
        alt: "Spring menu",
        href: `https://${backing?.domain}/${backing?.alias}`,
      },
    ]);
  });

  test("an image block's link can be added and removed later", async () => {
    const { id } = await add("pro", { type: "image", image: PNG });
    let row = await db.query.bioBlock.findFirst({ where: eq(schema.bioBlock.id, id) });
    expect(row?.linkId).toBeNull();

    await updateBlock(ctx("pro"), { id, url: "https://example.com/shop" });
    row = await db.query.bioBlock.findFirst({ where: eq(schema.bioBlock.id, id) });
    const linkId = row?.linkId ?? 0;
    expect(linkId).toBeGreaterThan(0);

    await updateBlock(ctx("pro"), { id, url: null });
    row = await db.query.bioBlock.findFirst({ where: eq(schema.bioBlock.id, id) });
    expect(row).toMatchObject({ url: null, linkId: null, content: PNG });
    expect(await db.query.link.findFirst({ where: eq(schema.link.id, linkId) })).toBeUndefined();
  });

  test("an image block's src can't be pointed at another site", async () => {
    const { id } = await add("pro", { type: "image", image: PNG });

    await expect(
      updateBlock(ctx("pro"), { id, image: "https://evil.example/pixel.png" }),
    ).rejects.toThrow(/must be uploaded/);
    await updateBlock(ctx("pro"), { id, content: "https://evil.example/pixel.png" });
    const row = await db.query.bioBlock.findFirst({ where: eq(schema.bioBlock.id, id) });
    expect(row?.content).toBe(PNG);
  });

  test("deleting a linked image block deletes its hidden link", async () => {
    const { id } = await add("pro", { type: "image", image: PNG, url: "https://example.com" });
    const row = await db.query.bioBlock.findFirst({ where: eq(schema.bioBlock.id, id) });

    await deleteBlock(ctx("pro"), id);

    expect(await blocksOnPage()).toHaveLength(0);
    expect(
      await db.query.link.findFirst({ where: eq(schema.link.id, row?.linkId ?? 0) }),
    ).toBeUndefined();
  });

  test("the public page and the editor get the embed's details", async () => {
    const { id } = await add("free", { type: "embed", url: YOUTUBE, title: "My video" });

    // SAFETY: same database client as ctx() above; public reads only use db.
    const publicCtx = { db, headers: new Headers() } as PublicTRPCContext;
    const page = await getPublicBioPageBySlug(publicCtx, SLUG);
    expect(page?.blocks).toEqual([
      { id, type: "embed", title: "My video", provider: "youtube", embedId: "dQw4w9WgXcQ" },
    ]);
    const editor = await getBioPage(ctx("free"), pageId);
    expect(editor.blocks[0]).toMatchObject({
      type: "embed",
      embed: { provider: "youtube", embedId: "dQw4w9WgXcQ" },
    });
  });
});
