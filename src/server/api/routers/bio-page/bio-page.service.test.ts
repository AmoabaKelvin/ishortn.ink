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
    if (pages.length) {
      await db.delete(schema.bioBlock).where(
        inArray(
          schema.bioBlock.bioPageId,
          pages.map((p) => p.id),
        ),
      );
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
    expect(result.breakdowns).toEqual({ countries: [], devices: [], referrers: [] });
  });

  test("page without link blocks returns empty breakdowns", async () => {
    await db.delete(schema.bioBlock).where(eq(schema.bioBlock.bioPageId, pageId));

    const result = await getBioPageAnalytics(ctx("pro"), { id: pageId, range: "all" });

    expect(result.perBlock).toEqual([]);
    expect(result.breakdowns).toEqual({ countries: [], devices: [], referrers: [] });
  });

  test("groups clicks across link blocks, with Unknown and Direct buckets", async () => {
    await db.insert(schema.linkVisit).values([
      { linkId: LINK_A, country: "Ghana", device: "mobile", referer: "instagram.com" },
      { linkId: LINK_A, country: "Ghana", device: "Mobile", referer: "instagram.com" },
      { linkId: LINK_A, country: "Ghana", device: "Desktop", referer: null },
      { linkId: LINK_B, country: "United States", device: "tablet", referer: "" },
      { linkId: LINK_B, country: null, device: null, referer: "direct" },
      { linkId: LINK_B, country: "", device: "", referer: "twitter" },
      // Not on this page: must not count.
      { linkId: FOREIGN_LINK, country: "France", device: "Desktop", referer: "google.com" },
    ]);

    const result = await getBioPageAnalytics(ctx("pro"), { id: pageId, range: "7d" });
    const { countries, devices, referrers } = result.breakdowns;

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
    expect(referrers).toEqual([
      { name: "Direct", clicks: 3 },
      { name: "instagram.com", clicks: 2 },
      { name: "Twitter", clicks: 1 },
    ]);
    for (const rows of [countries, devices, referrers]) {
      expect(rows.reduce((sum, r) => sum + r.clicks, 0)).toBe(result.totalClicks);
    }
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

    const countryTotals = async (plan: Plan, range: "7d" | "30d" | "all") => {
      const result = await getBioPageAnalytics(ctx(plan), { id: pageId, range });
      const sum = result.breakdowns.countries.reduce((s, r) => s + r.clicks, 0);
      expect(sum).toBe(result.totalClicks);
      return result.breakdowns.countries;
    };

    expect(await countryTotals("pro", "7d")).toEqual([{ name: "Ghana", clicks: 1 }]);
    expect(await countryTotals("pro", "30d")).toEqual([
      { name: "Ghana", clicks: 1 },
      { name: "Kenya", clicks: 1 },
    ]);
    expect(await countryTotals("pro", "all")).toEqual([
      { name: "Kenya", clicks: 2 },
      { name: "Ghana", clicks: 1 },
    ]);
    // Free plans are capped at 7 days whatever range is requested.
    expect(await countryTotals("free", "all")).toEqual([{ name: "Ghana", clicks: 1 }]);
  });
});
