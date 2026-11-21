import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { TRPCError } from "@trpc/server";
import { MySqlDialect } from "drizzle-orm/mysql-core";

import { INVALID_URL_MESSAGE } from "@/lib/utils/destination-url";
import { link, linkCreationFailure } from "@/server/db/schema";

import { bulkCreateLinks } from "./link.service";
import { RESTRICTED_LINK_REASON } from "./utils";

import type { WorkspaceTRPCContext } from "../../trpc";
import type { LinkCreationFailure } from "@/server/lib/link-creation/failures";
import type { Column, SQL } from "drizzle-orm";

type InsertedLink = {
  url: string;
  alias: string;
  domain: string;
  name?: string;
  note?: string;
  blocked?: boolean;
  blockedReason?: string;
};

type FakeOptions = {
  plan?: "free" | "pro";
  /** Active custom domains of the workspace, oldest first. */
  customDomains?: string[];
};

const dialect = new MySqlDialect();

// In-memory stand-in for the queries bulkCreateLinks makes: the plan lookup,
// custom-domain ownership (`customDomains`, none by default), alias availability
// (all free, none reserved), earlier imports (the links this context inserted),
// link inserts, failure records and the monthly count update.
function fakeContext(
  monthlyLinkCount: number,
  restrictedAt: Date | null = null,
  { plan = "free", customDomains = [] }: FakeOptions = {},
) {
  const inserted: InsertedLink[] = [];
  const recordedFailures: LinkCreationFailure[] = [];
  const countUpdates: Array<{ monthlyLinkCount: number }> = [];
  const db = {
    query: {
      user: {
        findFirst: async () => ({
          id: "user_1",
          monthlyLinkCount: countUpdates.at(-1)?.monthlyLinkCount ?? monthlyLinkCount,
          lastLinkCountReset: new Date(),
          createdAt: new Date(),
          subscriptions:
            plan === "free"
              ? null
              : { status: "active", plan, variantId: null, productId: null, endsAt: null },
        }),
      },
      customDomain: {
        // The ownership lookup filters by the domain it checks; read it back from the query.
        findFirst: async ({ where }: { where: SQL }) => {
          const { params } = dialect.sqlToQuery(where);
          const domain = customDomains.find((name) => params.includes(name));
          return domain ? { domain, status: "active" } : undefined;
        },
      },
    },
    // Queries are told apart by the columns they select.
    select: (fields: { url?: Column; domain?: Column }) => ({
      from: () => ({
        where: () => {
          if ("url" in fields) return Promise.resolve(inserted);
          if ("domain" in fields) {
            return {
              orderBy: () => ({ limit: async () => customDomains.map((domain) => ({ domain })) }),
            };
          }
          return { limit: async () => [] };
        },
      }),
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
      plan,
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

const fixture = (name: string) =>
  readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8");

// Pro workspace with go.example.com connected; the default domain is isht.app.
const bitlyContext = (monthlyLinkCount = 0) =>
  fakeContext(monthlyLinkCount, null, { plan: "pro", customDomains: ["go.example.com"] });

const UNCONNECTED =
  "links.other-brand.test isn't connected to this workspace. Add it in Domains, wait until it shows Active, then import this file again.";

describe("bulkCreateLinks with a Bitly export", () => {
  test("imports the current export, keeping Bitly's original codes", async () => {
    const { ctx, inserted, countUpdates } = bitlyContext(10);
    const result = await bulkCreateLinks(ctx, fixture("bitly-export-current.csv"), allowUrl);

    expect(result).toMatchObject({ created: 5, failed: 2, skipped: 1, alreadyImported: 0 });
    expect(result.message).toBe("5 links created, 2 failed, 1 skipped (deleted in Bitly)");
    expect(result.failures).toEqual([
      { row: 7, reason: UNCONNECTED },
      { row: 8, reason: "Alias is used by an earlier row in this file" },
    ]);
    expect(result.domainNotices).toEqual([UNCONNECTED]);
    expect(countUpdates).toEqual([{ monthlyLinkCount: 15 }]);

    const byAlias = new Map(inserted.map((row) => [`${row.domain}/${row.alias}`, row]));
    expect(byAlias.get("go.example.com/spring-menu")).toMatchObject({
      url: "https://example.com/menu/spring?utm_source=print",
      name: "Spring menu, dinner",
      note: "Imported from Bitly: https://go.example.com/3XCetqn",
    });
    expect(byAlias.get("go.example.com/3XCetqn")).toMatchObject({
      url: "https://example.com/menu/spring?utm_source=print",
      name: "Spring menu, dinner",
      note: "Bitly code for https://go.example.com/spring-menu",
    });
    expect(byAlias.get("go.example.com/3XABUQI")).toMatchObject({
      url: "https://example.com/book",
      name: "Booking page",
    });
    expect(byAlias.get("isht.app/example-reviews")).toMatchObject({
      url: "https://g.page/r/example/review",
    });
    const contact = inserted.find((row) => row.url === "https://example.com/contact");
    expect(contact).toMatchObject({
      domain: "isht.app",
      note: "Imported from Bitly: https://bit.ly/4zZyYxX",
    });
    expect(contact?.alias).toHaveLength(9);
    expect(contact?.name).toBeUndefined();
    expect(byAlias.has("go.example.com/4Dupe01")).toBe(false);
    expect(inserted.some((row) => row.url === "https://example.com/promo-2025")).toBe(false);

    expect(result.notices).toEqual([
      { row: 4, message: "bit.ly links stay on Bitly. Created isht.app/example-reviews." },
      { row: 5, message: `bit.ly links stay on Bitly. Created isht.app/${contact?.alias}.` },
    ]);
  });

  test("creates only the primary links when original codes are off", async () => {
    const { ctx, inserted } = bitlyContext();
    const result = await bulkCreateLinks(ctx, fixture("bitly-export-current.csv"), allowUrl, {
      keepBitlyCodes: false,
    });

    expect(result).toMatchObject({ created: 4, failed: 2, skipped: 1 });
    expect(inserted.some((row) => row.alias === "3XCetqn")).toBe(false);
  });

  test("counts links from an earlier run of the same file as already imported", async () => {
    const { ctx, inserted, countUpdates } = bitlyContext();
    await bulkCreateLinks(ctx, fixture("bitly-export-current.csv"), allowUrl);
    const again = await bulkCreateLinks(ctx, fixture("bitly-export-current.csv"), allowUrl);

    expect(again).toMatchObject({ created: 0, alreadyImported: 5, failed: 2, skipped: 1 });
    expect(again.failures.map((failure) => failure.row)).toEqual([7, 8]);
    expect(again.notices).toEqual([]);
    expect(inserted).toHaveLength(5);
    expect(countUpdates).toEqual([{ monthlyLinkCount: 5 }]);
  });

  test("imports the legacy export format", async () => {
    const { ctx, inserted } = bitlyContext();
    const result = await bulkCreateLinks(ctx, fixture("bitly-export-legacy.csv"), allowUrl);

    expect(result).toMatchObject({ created: 3, failed: 0, skipped: 0 });
    expect(inserted.map((row) => `${row.domain}/${row.alias}`).sort()).toEqual([
      "go.example.com/3GexGSC",
      "go.example.com/3vLl4Ax",
      "go.example.com/FAQ",
    ]);
  });

  test("allots the monthly allowance to rows before original codes", async () => {
    // Pro allows 1,000 links a month; two are left.
    const { ctx, inserted } = bitlyContext(998);
    const result = await bulkCreateLinks(ctx, fixture("bitly-export-legacy.csv"), allowUrl);

    expect(result.created).toBe(2);
    expect(result.failures).toEqual([
      {
        row: 2,
        reason: expect.stringContaining(
          "go.example.com/3vLl4Ax not kept: Monthly limit of 1,000 links reached",
        ),
      },
    ]);
    expect(inserted.map((row) => row.alias).sort()).toEqual(["3GexGSC", "FAQ"]);
  });

  test("moves a bit.ly back-half that is invalid here to a generated alias", async () => {
    const { ctx, inserted } = bitlyContext();
    const result = await bulkCreateLinks(
      ctx,
      [
        "Link,Custom Link,Title,Destination URL,Status",
        "https://bit.ly/abc,https://bit.ly/menu.pdf,,https://example.com/a,Active",
        "https://go.example.com/xyz,https://go.example.com/a/b,,https://example.com/b,Active",
        ",,,https://example.com/c,Active",
      ].join("\n"),
      allowUrl,
    );

    expect(result.notices).toEqual([
      {
        row: 2,
        message: expect.stringMatching(
          /^bit\.ly links stay on Bitly, and the back-half menu\.pdf isn't available here\. Created isht\.app\/\w{9}\.$/,
        ),
      },
    ]);
    expect(result.failures).toEqual([
      { row: 3, reason: expect.stringContaining("alphanumeric") },
      { row: 4, reason: "This row has no valid Bitly link" },
    ]);
    expect(inserted.map((row) => row.domain)).toEqual(["isht.app"]);
  });
});
