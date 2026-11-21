import { describe, expect, test } from "bun:test";

import { TRPCError } from "@trpc/server";

import { INVALID_URL_MESSAGE } from "@/lib/utils/destination-url";
import { link, linkCreationFailure } from "@/server/db/schema";

import { bulkCreateLinks } from "./link.service";
import { RESTRICTED_LINK_REASON } from "./utils";

import type { WorkspaceTRPCContext } from "../../trpc";
import type { LinkCreationFailure } from "@/server/lib/link-creation/failures";

type InsertedLink = {
  url: string;
  alias: string;
  domain: string;
  blocked?: boolean;
  blockedReason?: string;
};

// In-memory stand-in for the queries bulkCreateLinks makes: the plan lookup,
// custom-domain ownership (the workspace owns none), alias availability (all
// free), link inserts, failure records and the monthly count update.
function fakeContext(monthlyLinkCount: number, restrictedAt: Date | null = null) {
  const inserted: InsertedLink[] = [];
  const recordedFailures: LinkCreationFailure[] = [];
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
    insert: (table: typeof link | typeof linkCreationFailure) => ({
      values: async (values: InsertedLink | LinkCreationFailure[]) => {
        if (table === linkCreationFailure && Array.isArray(values)) {
          recordedFailures.push(...values);
        } else if (!Array.isArray(values)) {
          inserted.push(values);
        }
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
    restrictedAt,
    workspace: {
      type: "personal",
      userId: "user_1",
      teamId: null,
      teamSlug: null,
      role: "owner",
      plan: "free",
    },
  } as WorkspaceTRPCContext;
  return { ctx, inserted, countUpdates, recordedFailures };
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
      { row: 4, reason: expect.stringContaining("Monthly limit of 30 links reached") },
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
      { row: 2, reason: "Selected domain is not available for this workspace." },
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
      { row: 2, reason: expect.stringContaining("alphanumeric") },
      { row: 3, reason: expect.stringContaining("at least 6 characters") },
      { row: 5, reason: "Alias is used by an earlier row in this file" },
    ]);
    expect(inserted.map((row) => row.alias)).toEqual(["Repeated"]);
  });

  test("reports rows that fail the URL safety check or have no url", async () => {
    const { ctx, inserted, countUpdates } = fakeContext(0);
    const result = await bulkCreateLinks(
      ctx,
      csv(",,,no url", "not a url,,,", "https://bad.example,,,"),
      async () => {
        throw new Error("This URL looks suspicious");
      },
    );

    expect(result.failures).toEqual([
      { row: 2, reason: "Missing url" },
      { row: 3, reason: INVALID_URL_MESSAGE },
      { row: 4, reason: "This URL looks suspicious" },
    ]);
    expect(inserted).toEqual([]);
    expect(countUpdates).toEqual([]);
  });

  test("reports spreadsheet row numbers, counting the header and blank rows", async () => {
    const { ctx, inserted } = fakeContext(0);
    const result = await bulkCreateLinks(
      ctx,
      [
        "\uFEFFURL,Alias,Note",
        "https://a.example,,",
        "",
        '"https://b.example",,"two',
        'lines"',
        ",,no url here",
      ].join("\r\n"),
      allowUrl,
    );

    expect(result.failures).toEqual([{ row: 5, reason: "Missing url" }]);
    expect(inserted.map((row) => row.url).sort()).toEqual([
      "https://a.example",
      "https://b.example",
    ]);
  });

  test("refuses files without a url column or without rows", async () => {
    const { ctx, inserted } = fakeContext(0);
    await expect(bulkCreateLinks(ctx, "link,alias\nhttps://a.example,x", allowUrl)).rejects.toThrow(
      '"url" column',
    );
    await expect(bulkCreateLinks(ctx, "url,alias\n", allowUrl)).rejects.toThrow(
      "no links to import",
    );
    expect(inserted).toEqual([]);
  });

  test("records each failed row with the step it failed in", async () => {
    const { ctx, recordedFailures } = fakeContext(0);
    const result = await bulkCreateLinks(
      ctx,
      csv(",,,no url", "https://bad.example,,,", "https://ok.example,,,"),
      async (url) => {
        if (url === "https://bad.example") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "This URL looks suspicious" });
        }
      },
    );

    expect(result).toMatchObject({ created: 1, failed: 2 });
    expect(recordedFailures).toEqual([
      expect.objectContaining({
        source: "bulk",
        step: "validation",
        code: "BAD_REQUEST",
        serverError: false,
      }),
      expect.objectContaining({
        source: "bulk",
        step: "safety",
        code: "BAD_REQUEST",
        serverError: false,
      }),
    ]);
  });

  test("records a whole-import rejection once", async () => {
    const { ctx, recordedFailures } = fakeContext(30);
    await expect(bulkCreateLinks(ctx, csv("https://a.example,,,"), allowUrl)).rejects.toThrow();
    expect(recordedFailures).toEqual([
      { source: "bulk", step: "validation", code: "FORBIDDEN", serverError: false },
    ]);
  });

  test("inserts links already blocked if the account is restricted", async () => {
    const { ctx, inserted } = fakeContext(0, new Date());
    const result = await bulkCreateLinks(ctx, csv("https://a.example,,,"), allowUrl);

    expect(result.created).toBe(1);
    expect(inserted[0]).toMatchObject({
      blocked: true,
      blockedReason: RESTRICTED_LINK_REASON,
    });
  });
});
