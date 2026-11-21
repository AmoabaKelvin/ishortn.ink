import { describe, expect, test } from "bun:test";

import { TRPCError } from "@trpc/server";
import { MySqlDialect } from "drizzle-orm/mysql-core";

import { INVALID_URL_MESSAGE } from "@/lib/utils/destination-url";
import { customDomain, link, linkCreationFailure } from "@/server/db/schema";

import { bulkCreateLinks } from "./link.service";
import { customDomainImportAllowanceLeft, RESTRICTED_LINK_REASON } from "./utils";

import type { WorkspaceTRPCContext } from "../../trpc";
import type { LinkCreationFailure } from "@/server/lib/link-creation/failures";
import type { SQL } from "drizzle-orm";
import type { MySqlTable } from "drizzle-orm/mysql-core";

type InsertedLink = {
  url: string;
  alias: string;
  domain: string;
  blocked?: boolean;
  blockedReason?: string;
};

type FakeDomain = { domain: string; status: "active" | "pending" };

type FakeOptions = {
  restrictedAt?: Date | null;
  plan?: "free" | "pro";
  customDomainImportCount?: number;
  domains?: FakeDomain[];
};

const dialect = new MySqlDialect();
const sqlParams = (value: SQL) => dialect.sqlToQuery(value).params;

// In-memory stand-in for the queries bulkCreateLinks makes: the plan lookup,
// custom-domain ownership (matched on the rendered query's domain and status),
// alias availability (all free, none reserved), link inserts, failure records and
// the monthly and import count updates, which write back to `account`.
function fakeContext(
  monthlyLinkCount: number,
  {
    restrictedAt = null,
    plan = "free",
    customDomainImportCount = 0,
    domains = [],
  }: FakeOptions = {},
) {
  const inserted: InsertedLink[] = [];
  const recordedFailures: LinkCreationFailure[] = [];
  const countUpdates: Array<{ monthlyLinkCount: number }> = [];
  const account = { monthlyLinkCount, customDomainImportCount };
  const subscription = plan === "pro" ? { status: "active", plan: "pro" } : null;
  const db = {
    query: {
      user: {
        findFirst: async () => ({
          id: "user_1",
          ...account,
          lastLinkCountReset: new Date(),
          createdAt: new Date(),
          subscriptions: subscription,
        }),
      },
      customDomain: {
        findFirst: async ({ where }: { where: SQL }) => {
          const params = sqlParams(where);
          return domains.find(
            (domain) => params.includes(domain.domain) && params.includes(domain.status),
          );
        },
      },
    },
    select: () => ({
      from: (table: MySqlTable) => {
        const rows = table === customDomain ? domains.map(({ domain }) => ({ domain })) : [];
        const limit = async () => rows;
        return { where: () => ({ limit, orderBy: () => ({ limit }) }) };
      },
    }),
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
      set: (values: { monthlyLinkCount?: number; customDomainImportCount?: SQL }) => ({
        where: async () => {
          if (values.monthlyLinkCount !== undefined) {
            countUpdates.push({ monthlyLinkCount: values.monthlyLinkCount });
            account.monthlyLinkCount = values.monthlyLinkCount;
          }
          if (values.customDomainImportCount) {
            const [added] = sqlParams(values.customDomainImportCount);
            account.customDomainImportCount += Number(added);
          }
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
      plan,
    },
  } as WorkspaceTRPCContext;
  return { ctx, inserted, countUpdates, recordedFailures, account };
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
    const { ctx, inserted } = fakeContext(0, { restrictedAt: new Date() });
    const result = await bulkCreateLinks(ctx, csv("https://a.example,,,"), allowUrl);

    expect(result.created).toBe(1);
    expect(inserted[0]).toMatchObject({
      blocked: true,
      blockedReason: RESTRICTED_LINK_REASON,
    });
  });
});

describe("bulkCreateLinks custom-domain import allowance", () => {
  const brand: FakeDomain = { domain: "go.acme.com", status: "active" };
  const rowsOn = (domain: string, count: number, from = 0) =>
    Array.from({ length: count }, (_, index) => `https://acme.example/${from + index},,${domain},`);

  test("a Pro workspace imports 1,500 rows on its active custom domain without using its monthly limit", async () => {
    const { ctx, inserted, countUpdates, account } = fakeContext(990, {
      plan: "pro",
      domains: [brand],
    });

    const first = await bulkCreateLinks(ctx, csv(...rowsOn("go.acme.com", 1000)), allowUrl);
    const second = await bulkCreateLinks(ctx, csv(...rowsOn("go.acme.com", 500, 1000)), allowUrl);

    expect(first).toMatchObject({
      created: 1000,
      failed: 0,
      importAllowanceUsed: 1000,
      importAllowanceRemaining: 4000,
    });
    expect(second).toMatchObject({
      created: 500,
      failed: 0,
      importAllowanceUsed: 500,
      importAllowanceRemaining: 3500,
    });
    expect(second.message).toBe(
      "500 links created, 0 failed. 500 on your custom domain used the one-time import allowance instead of your monthly limit (3,500 of 5,000 left)",
    );
    expect(inserted).toHaveLength(1500);
    expect(countUpdates).toEqual([]);
    expect(account).toEqual({ monthlyLinkCount: 990, customDomainImportCount: 1500 });
  });

  test("rows on platform domains still count toward the monthly limit", async () => {
    const { ctx, countUpdates, account } = fakeContext(5, { plan: "pro", domains: [brand] });
    const result = await bulkCreateLinks(
      ctx,
      csv(...rowsOn("go.acme.com", 2), "https://a.example,,ishortn.ink,", "https://b.example,,,"),
      allowUrl,
    );

    expect(result).toMatchObject({ created: 4, failed: 0, importAllowanceUsed: 2 });
    expect(countUpdates).toEqual([{ monthlyLinkCount: 7 }]);
    expect(account.customDomainImportCount).toBe(2);
  });

  test("custom-domain rows still go through the URL safety check", async () => {
    const { ctx, account } = fakeContext(0, { plan: "pro", domains: [brand] });
    const checked: string[] = [];
    const result = await bulkCreateLinks(
      ctx,
      csv("https://bad.example,,go.acme.com,", "https://ok.example,,go.acme.com,"),
      async (url) => {
        checked.push(url);
        if (url === "https://bad.example") throw new Error("This URL looks suspicious");
      },
    );

    expect(checked.sort()).toEqual(["https://bad.example", "https://ok.example"]);
    expect(result).toMatchObject({ created: 1, importAllowanceUsed: 1 });
    expect(result.failures).toEqual([{ row: 2, reason: "This URL looks suspicious" }]);
    // Only created links use the allowance.
    expect(account.customDomainImportCount).toBe(1);
  });

  test("imports custom-domain rows once the monthly limit is used up", async () => {
    const { ctx, countUpdates, account } = fakeContext(1000, { plan: "pro", domains: [brand] });
    const result = await bulkCreateLinks(
      ctx,
      csv(...rowsOn("go.acme.com", 1), "https://a.example,,ishortn.ink,"),
      allowUrl,
    );

    expect(result.created).toBe(1);
    expect(result.failures).toEqual([
      { row: 3, reason: expect.stringContaining("Monthly limit of 1,000 links reached") },
    ]);
    expect(countUpdates).toEqual([]);
    expect(account.customDomainImportCount).toBe(1);
  });

  test("falls back to the monthly limit once 5,000 rows have used the allowance", async () => {
    const { ctx, countUpdates, account } = fakeContext(998, {
      plan: "pro",
      customDomainImportCount: 4998,
      domains: [brand],
    });
    const result = await bulkCreateLinks(ctx, csv(...rowsOn("go.acme.com", 5)), allowUrl);

    // Two rows finish the allowance, two take the last monthly slots, one is over both.
    expect(result).toMatchObject({
      created: 4,
      importAllowanceUsed: 2,
      importAllowanceRemaining: 0,
    });
    expect(result.failures).toEqual([
      { row: 6, reason: expect.stringContaining("Monthly limit of 1,000 links reached") },
    ]);
    expect(countUpdates).toEqual([{ monthlyLinkCount: 1000 }]);
    expect(account.customDomainImportCount).toBe(5000);

    await expect(
      bulkCreateLinks(ctx, csv(...rowsOn("go.acme.com", 1, 5)), allowUrl),
    ).rejects.toThrow("monthly limit of 1,000 links");
  });

  test("a domain that is not active gets no allowance", async () => {
    const { ctx, inserted, account } = fakeContext(1000, {
      plan: "pro",
      domains: [{ domain: "go.acme.com", status: "pending" }],
    });
    const result = await bulkCreateLinks(ctx, csv(...rowsOn("go.acme.com", 2)), allowUrl);

    expect(result).toMatchObject({ created: 0, failed: 2, importAllowanceUsed: 0 });
    expect(result.failures[0]?.reason).toBe("Selected domain is not available for this workspace.");
    expect(inserted).toEqual([]);
    expect(account.customDomainImportCount).toBe(0);
  });

  test("free workspaces keep counting every row and are rejected at the monthly limit", async () => {
    const { ctx, account } = fakeContext(30, { domains: [brand] });
    await expect(bulkCreateLinks(ctx, csv(...rowsOn("go.acme.com", 1)), allowUrl)).rejects.toThrow(
      "monthly limit of 30 links",
    );
    expect(account.customDomainImportCount).toBe(0);
  });
});

describe("customDomainImportAllowanceLeft", () => {
  test("applies only to capped paid plans", () => {
    expect(customDomainImportAllowanceLeft("free", 30, 0)).toBe(0);
    expect(customDomainImportAllowanceLeft("ultra", undefined, 0)).toBe(0);
    expect(customDomainImportAllowanceLeft("pro", 1000, 0)).toBe(5000);
  });

  test("counts down to zero and never below", () => {
    expect(customDomainImportAllowanceLeft("pro", 1000, 4200)).toBe(800);
    expect(customDomainImportAllowanceLeft("pro", 1000, 6000)).toBe(0);
  });
});
