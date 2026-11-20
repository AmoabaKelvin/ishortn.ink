import { describe, expect, test } from "bun:test";

import { bulkCreateLinks } from "./link.service";

import type { WorkspaceTRPCContext } from "../../trpc";

type InsertedLink = { url: string; alias: string; domain: string };

// In-memory stand-in for the queries bulkCreateLinks makes: the plan lookup,
// custom-domain ownership (the workspace owns none), alias availability (all
// free), link inserts and the monthly count update.
function fakeContext(monthlyLinkCount: number) {
  const inserted: InsertedLink[] = [];
  const countUpdates: Array<{ monthlyLinkCount: number }> = [];
  const db = {
    query: {
      user: {
        findFirst: async () => ({
          id: "user_1",
          monthlyLinkCount,
          lastLinkCountReset: new Date(),
          createdAt: new Date(),
          subscriptions: null,
        }),
      },
      customDomain: { findFirst: async () => undefined },
    },
    select: () => ({ from: () => ({ where: async () => [] }) }),
    insert: () => ({
      values: async (values: InsertedLink) => {
        inserted.push(values);
      },
    }),
    update: () => ({
      set: (values: { monthlyLinkCount: number }) => ({
        where: async () => {
          countUpdates.push(values);
        },
      }),
    }),
  };
  // SAFETY: bulkCreateLinks only reaches the db methods stubbed above, plus
  // ctx.workspace and ctx.auth.userId.
  const ctx = {
    db,
    auth: { userId: "user_1" },
    workspace: {
      type: "personal",
      userId: "user_1",
      teamId: null,
      teamSlug: null,
      role: "owner",
      plan: "free",
    },
  } as WorkspaceTRPCContext;
  return { ctx, inserted, countUpdates };
}

const allowUrl = async () => {};

const csv = (...lines: string[]) => ["url,alias,domain,note", ...lines].join("\n");

describe("bulkCreateLinks", () => {
  test("creates valid rows and counts them against the monthly allowance", async () => {
    const { ctx, inserted, countUpdates } = fakeContext(3);
    const result = await bulkCreateLinks(
      ctx,
      csv("https://a.example,,,", "https://b.example,my-alias,ishortn.ink,hi"),
      allowUrl,
    );

    expect(result).toMatchObject({ created: 2, failed: 0, failures: [] });
    const byUrl = new Map(inserted.map((row) => [row.url, row]));
    expect(byUrl.get("https://a.example")).toMatchObject({ domain: "isht.app" });
    expect(byUrl.get("https://a.example")?.alias).toHaveLength(9);
    expect(byUrl.get("https://b.example")).toMatchObject({
      alias: "my-alias",
      domain: "ishortn.ink",
    });
    expect(countUpdates).toEqual([{ monthlyLinkCount: 5 }]);
  });

  test("creates only the rows within the remaining free allowance", async () => {
    const { ctx, inserted, countUpdates } = fakeContext(28);
    const checked: string[] = [];
    const result = await bulkCreateLinks(
      ctx,
      csv("https://a.example,,,", "https://b.example,,,", "https://c.example,,,"),
      async (url) => {
        checked.push(url);
      },
    );

    expect(result.created).toBe(2);
    expect(result.failures).toEqual([
      { row: 3, reason: expect.stringContaining("Monthly limit of 30 links reached") },
    ]);
    expect(inserted.map((row) => row.url).sort()).toEqual([
      "https://a.example",
      "https://b.example",
    ]);
    // Rows past the allowance skip the URL safety scan entirely.
    expect(checked).toEqual(["https://a.example", "https://b.example"]);
    expect(countUpdates).toEqual([{ monthlyLinkCount: 30 }]);
  });

  test("rejects the whole import when the allowance is already used up", async () => {
    const { ctx, inserted } = fakeContext(30);
    await expect(bulkCreateLinks(ctx, csv("https://a.example,,,"), allowUrl)).rejects.toThrow(
      "monthly limit of 30 links",
    );
    expect(inserted).toEqual([]);
  });

  test("rejects rows whose domain the workspace does not own", async () => {
    const { ctx, inserted } = fakeContext(0);
    const result = await bulkCreateLinks(
      ctx,
      csv("https://a.example,,evil.example,", "https://b.example,,,"),
      allowUrl,
    );

    expect(result.failures).toEqual([
      { row: 1, reason: "Selected domain is not available for this workspace." },
    ]);
    expect(inserted.map((row) => row.url)).toEqual(["https://b.example"]);
  });

  test("rejects invalid, short and duplicate aliases", async () => {
    const { ctx, inserted } = fakeContext(0);
    const result = await bulkCreateLinks(
      ctx,
      csv(
        "https://a.example,bad alias!,,",
        "https://b.example,abc,,",
        "https://c.example,Repeated,,",
        "https://d.example,repeated,,",
      ),
      allowUrl,
    );

    expect(result.failures).toEqual([
      { row: 1, reason: expect.stringContaining("alphanumeric") },
      { row: 2, reason: expect.stringContaining("at least 6 characters") },
      { row: 4, reason: "Alias is used by an earlier row in this file" },
    ]);
    expect(inserted.map((row) => row.alias)).toEqual(["Repeated"]);
  });

  test("reports rows that fail the URL safety check or have no url", async () => {
    const { ctx, inserted, countUpdates } = fakeContext(0);
    const result = await bulkCreateLinks(ctx, csv(",,,", "https://bad.example,,,"), async () => {
      throw new Error("This URL looks suspicious");
    });

    expect(result.failures).toEqual([
      { row: 1, reason: "Missing or invalid url" },
      { row: 2, reason: "This URL looks suspicious" },
    ]);
    expect(inserted).toEqual([]);
    expect(countUpdates).toEqual([]);
  });
});
