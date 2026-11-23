import { afterAll, beforeEach, describe, expect, test } from "bun:test";

import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

import * as schema from "@/server/db/schema";

import { getBioPageAnalytics } from "./bio-page.service";

import type { WorkspaceTRPCContext } from "../../trpc";
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

  // LinkVisit's browser, os and city are NOT NULL; these tests only group by country and device.
  const visit = (row: { linkId: number; country: string; device: string; createdAt?: Date }) => ({
    browser: "Chrome",
    os: "macOS",
    city: "Unknown",
    ...row,
  });

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
    await db.insert(schema.user).values({ id: USER_ID, email: `${USER_ID}@example.com` });
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
    await db.insert(schema.linkVisit).values(
      [
        { linkId: LINK_A, country: "Ghana", device: "mobile" },
        { linkId: LINK_A, country: "Ghana", device: "Mobile" },
        { linkId: LINK_A, country: "Ghana", device: "Desktop" },
        { linkId: LINK_B, country: "United States", device: "tablet" },
        { linkId: LINK_B, country: "Unknown", device: "Unknown" },
        { linkId: LINK_B, country: "", device: "" },
        // Not on this page: must not count.
        { linkId: FOREIGN_LINK, country: "France", device: "Desktop" },
      ].map(visit),
    );

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
    await db.insert(schema.linkVisit).values(
      [
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
      ].map(visit),
    );

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
