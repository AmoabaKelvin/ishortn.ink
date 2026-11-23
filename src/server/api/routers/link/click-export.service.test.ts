import { afterAll, beforeEach, describe, expect, test } from "bun:test";

import { subDays, subHours } from "date-fns";
import { inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

import * as schema from "@/server/db/schema";

import { exportClicks } from "./click-export.service";

import type { WorkspaceTRPCContext } from "../../trpc";
import type { Plan } from "@/lib/billing/plans";

// Exercises the click export against a real MySQL. Set TEST_DATABASE_URL to
// run it; see CONTRIBUTING.md, "Database tests".
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("exportClicks (MySQL)", () => {
  const pool = mysql.createPool({ uri: testDatabaseUrl ?? "", connectionLimit: 5 });
  const db = drizzle(pool, { schema, mode: "default" });

  const OWNER = "click_export_owner";
  const OTHER = "click_export_other";
  const DOMAIN = "ishortn.ink";
  const HOOK_TIMEOUT_MS = 30_000;

  const ctxFor = (userId: string, plan: Plan) =>
    // SAFETY: mirrors what workspaceProcedure resolves for a personal workspace;
    // exportClicks reads only db and workspace.
    ({
      db,
      auth: { userId },
      restrictedAt: null,
      workspace: {
        type: "personal",
        userId,
        teamId: null,
        teamSlug: null,
        role: "owner",
        plan,
      },
    }) as WorkspaceTRPCContext;

  const dataLines = (csv: string) => csv.trimEnd().split("\r\n").slice(1);

  async function cleanup() {
    const links = await db
      .select({ id: schema.link.id })
      .from(schema.link)
      .where(inArray(schema.link.userId, [OWNER, OTHER]));
    if (links.length) {
      await db.delete(schema.linkVisit).where(
        inArray(
          schema.linkVisit.linkId,
          links.map((row) => row.id),
        ),
      );
    }
    await db.delete(schema.link).where(inArray(schema.link.userId, [OWNER, OTHER]));
    await db.delete(schema.user).where(inArray(schema.user.id, [OWNER, OTHER]));
  }

  async function insertLink(userId: string, alias: string, extra: { isQrCode?: boolean } = {}) {
    const [inserted] = await db.insert(schema.link).values({
      url: `https://example.com/${alias}`,
      alias,
      domain: DOMAIN,
      userId,
      ...extra,
    });
    return Number(inserted.insertId);
  }

  beforeEach(async () => {
    await cleanup();
    await db.insert(schema.user).values([
      { id: OWNER, email: `${OWNER}@example.com` },
      { id: OTHER, email: `${OTHER}@example.com` },
    ]);
    const now = new Date();
    const linkA = await insertLink(OWNER, "click-export-a");
    const linkB = await insertLink(OWNER, "click-export-b");
    const qr = await insertLink(OWNER, "click-export-qr", { isQrCode: true });
    const otherLink = await insertLink(OTHER, "click-export-other");
    const visitor = { device: "Desktop", browser: "Chrome", os: "macOS", city: "Unknown" };
    await db.insert(schema.linkVisit).values([
      {
        ...visitor,
        linkId: linkA,
        country: "GH",
        city: "Accra",
        referer: "twitter",
        createdAt: subHours(now, 2),
      },
      { ...visitor, linkId: linkA, country: "US", referer: "null", createdAt: subDays(now, 20) },
      { ...visitor, linkId: linkB, country: "DE", createdAt: subDays(now, 3) },
      { ...visitor, linkId: qr, country: "FR", createdAt: subDays(now, 1) },
      { ...visitor, linkId: otherLink, country: "NG", createdAt: subDays(now, 1) },
    ]);
  }, HOOK_TIMEOUT_MS);

  afterAll(async () => {
    await cleanup();
    await pool.end();
  }, HOOK_TIMEOUT_MS);

  test("refuses free workspaces", async () => {
    await expect(
      exportClicks(ctxFor(OWNER, "free"), { range: "7d", filterType: "all" }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  test("refuses a link from another workspace", async () => {
    await expect(
      exportClicks(ctxFor(OWNER, "pro"), {
        range: "7d",
        filterType: "all",
        link: { alias: "click-export-other", domain: DOMAIN },
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("exports one link's clicks within the range, newest first", async () => {
    const result = await exportClicks(ctxFor(OWNER, "pro"), {
      range: "7d",
      filterType: "all",
      link: { alias: "click-export-a", domain: DOMAIN },
    });
    expect(result.rowCount).toBe(1);
    expect(result.truncated).toBe(false);
    const [line] = dataLines(result.csv);
    expect(line).toContain(
      `"https://${DOMAIN}/click-export-a","https://example.com/click-export-a","GH","Accra"`,
    );
    expect(line).toEndWith('"X"');

    const month = await exportClicks(ctxFor(OWNER, "pro"), {
      range: "30d",
      filterType: "all",
      link: { alias: "click-export-a", domain: DOMAIN },
    });
    expect(month.rowCount).toBe(2);
    const lines = dataLines(month.csv);
    expect(lines[0]).toContain('"GH"');
    expect(lines[1]).toContain('"US"');
    expect(lines[1]).toEndWith('"Direct"');
  });

  test("a custom range exports exactly the selected days", async () => {
    const day = (offset: number) => subDays(new Date(), offset).toISOString().slice(0, 10);
    // Only the click 20 days ago falls in [21, 19] days ago; the 7d clicks don't.
    const result = await exportClicks(ctxFor(OWNER, "pro"), {
      range: "custom",
      from: day(21),
      to: day(19),
      filterType: "all",
    });
    expect(result.rowCount).toBe(1);
    expect(result.csv).toContain('"US"');

    // The window ends at the end of `to`: a range ending 3 days ago includes that day's click.
    const toDay = await exportClicks(ctxFor(OWNER, "pro"), {
      range: "custom",
      from: day(3),
      to: day(3),
      filterType: "all",
      link: { alias: "click-export-b", domain: DOMAIN },
    });
    expect(toDay.rowCount).toBe(1);
    expect(toDay.csv).toContain('"DE"');
  });

  test("overview exports only the workspace's short links in range", async () => {
    const result = await exportClicks(ctxFor(OWNER, "ultra"), { range: "7d", filterType: "all" });
    expect(result.rowCount).toBe(2);
    expect(result.csv).toContain("click-export-a");
    expect(result.csv).toContain("click-export-b");
    expect(result.csv).not.toContain("click-export-qr");
    expect(result.csv).not.toContain("click-export-other");
  });

  test("overview honours the link filter", async () => {
    const [linkB] = await db
      .select({ id: schema.link.id })
      .from(schema.link)
      .where(inArray(schema.link.alias, ["click-export-b"]));
    const result = await exportClicks(ctxFor(OWNER, "pro"), {
      range: "30d",
      filterType: "link",
      filterId: linkB!.id,
    });
    expect(result.rowCount).toBe(1);
    expect(result.csv).toContain("click-export-b");
  });
});
