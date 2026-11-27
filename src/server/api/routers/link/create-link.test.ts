import { describe, expect, test } from "bun:test";

import { LINK_UTM_PLAN_MESSAGE, PLAN_VARIANT_IDS } from "@/lib/billing/plans";
import { DEFAULT_PLATFORM_DOMAIN } from "@/lib/constants/domains";
import { link, linkCreationFailure } from "@/server/db/schema";
import { parseScrapedPage } from "@/server/lib/metadata";

import { createLink } from "./link.service";

import type { WorkspaceTRPCContext } from "../../trpc";
import type { LinkCreationFailure } from "@/server/lib/link-creation/failures";

type InsertedLink = {
  url: string;
  name: string;
  alias: string;
  domain: string;
  utmParams?: unknown;
};

// In-memory stand-in for the queries createLink makes on a free personal
// workspace: the plan lookup, the reserved-alias check for the generated alias
// (none reserved), the link insert, failure records and the
// monthly count update. `failInsert` makes the link insert throw like a
// database outage would.
function fakeContext({
  failInsert = false,
  plan = "free",
}: { failInsert?: boolean; plan?: "free" | "pro" | "ultra" } = {}) {
  const inserted: InsertedLink[] = [];
  const recordedFailures: LinkCreationFailure[] = [];
  const db = {
    query: {
      user: {
        findFirst: async () => ({
          id: "user_1",
          monthlyLinkCount: 0,
          lastLinkCountReset: new Date(),
          createdAt: new Date(),
          subscriptions:
            plan === "free"
              ? null
              : { status: "active", plan, variantId: PLAN_VARIANT_IDS[plan].monthly },
        }),
      },
    },
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
    insert: (table: typeof link | typeof linkCreationFailure) => ({
      values: async (values: InsertedLink | LinkCreationFailure[]) => {
        if (table === linkCreationFailure && Array.isArray(values)) {
          recordedFailures.push(...values);
          return [];
        }
        if (table !== link || Array.isArray(values)) throw new Error("unexpected insert");
        if (failInsert) {
          throw Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" });
        }
        inserted.push(values);
        return [{ insertId: 7 }];
      },
    }),
    update: () => ({ set: () => ({ where: async () => {} }) }),
    // The link insert runs in a transaction; the stub hands the callback itself as `tx`.
    transaction: async <T>(run: (tx: typeof db) => Promise<T>) => run(db),
  };
  // SAFETY: createLink without tags, geo rules, campaign or image only reaches
  // the db methods stubbed above, plus ctx.workspace and ctx.auth.userId.
  const ctx = {
    db,
    auth: { userId: "user_1" },
    workspace: {
      type: "personal",
      userId: "user_1",
      teamId: null,
      teamSlug: null,
      role: "owner",
      plan,
    },
  } as WorkspaceTRPCContext;
  return { ctx, inserted, recordedFailures };
}

// Safety layers that pass the URL without network or database calls.
const allowUrl = {
  preChecks: async () => ({ blocked: false, reason: "", userMessage: "" }),
  readVerdict: async () => false,
  rememberVerdict: () => {},
  scrape: async (url: string) => parseScrapedPage("<title>Page</title>", url, 200, new Headers()),
  detect: async (url: string) => ({ url, phishing: false }),
};
const noMetadata = async () => ({ title: "", description: "", image: "", favicon: "" });
const URL = "https://example.com/page";

describe("createLink", () => {
  test("creates the link when the metadata fetch throws", async () => {
    const { ctx, inserted, recordedFailures } = fakeContext();
    const result = await createLink(
      ctx,
      { url: URL },
      {
        ...allowUrl,
        fetchMetadata: async () => {
          throw new Error("metadata service unavailable");
        },
      },
    );

    expect(result).toEqual({ id: 7, alias: expect.any(String), domain: DEFAULT_PLATFORM_DOMAIN });
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ url: URL, name: "Untitled Link" });
    expect(recordedFailures).toEqual([]);
  });

  test("returns the id, alias and domain of the inserted link", async () => {
    const { ctx, inserted } = fakeContext();
    const generated = await createLink(
      ctx,
      { url: URL },
      { ...allowUrl, fetchMetadata: noMetadata },
    );
    expect(generated).toEqual({
      id: 7,
      alias: inserted[0]!.alias,
      domain: DEFAULT_PLATFORM_DOMAIN,
    });
    expect(generated.alias).not.toBe("");

    const custom = await createLink(
      ctx,
      { url: URL, alias: "spring-sale" },
      { ...allowUrl, fetchMetadata: noMetadata },
    );
    expect(custom).toEqual({ id: 7, alias: "spring-sale", domain: DEFAULT_PLATFORM_DOMAIN });
    expect(inserted[1]).toMatchObject({ alias: "spring-sale", domain: DEFAULT_PLATFORM_DOMAIN });
  });

  test("uses fetched metadata when the fetch succeeds", async () => {
    const { ctx, inserted } = fakeContext();
    await createLink(
      ctx,
      { url: URL },
      {
        ...allowUrl,
        fetchMetadata: async () => ({
          title: "Example",
          description: "An example page",
          image: "",
          favicon: "",
        }),
      },
    );

    expect(inserted[0]).toMatchObject({ name: "Example" });
  });

  test("records a database failure as a server-side db failure and rethrows it", async () => {
    const { ctx, recordedFailures } = fakeContext({ failInsert: true });
    await expect(
      createLink(ctx, { url: URL }, { ...allowUrl, fetchMetadata: noMetadata }),
    ).rejects.toThrow("ECONNREFUSED");

    expect(recordedFailures).toEqual([
      { source: "dashboard", step: "db", code: "ECONNREFUSED", serverError: true },
    ]);
  });

  test("records a plan rejection as a client-side validation failure", async () => {
    const { ctx, inserted, recordedFailures } = fakeContext();
    await expect(
      createLink(ctx, { url: URL, cloaking: true }, { ...allowUrl, fetchMetadata: noMetadata }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(inserted).toEqual([]);
    expect(recordedFailures).toEqual([
      { source: "dashboard", step: "validation", code: "FORBIDDEN", serverError: false },
    ]);
  });
});

describe("createLink UTM parameters", () => {
  const utmParams = { utm_source: "newsletter", utm_medium: "email" };

  test("are refused on Free with a prompt that points to Pro", async () => {
    const { ctx, inserted } = fakeContext();
    await expect(
      createLink(ctx, { url: URL, utmParams }, { ...allowUrl, fetchMetadata: noMetadata }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", message: LINK_UTM_PLAN_MESSAGE });
    expect(inserted).toEqual([]);
  });

  test("are saved on Pro and Ultra", async () => {
    for (const plan of ["pro", "ultra"] as const) {
      const { ctx, inserted } = fakeContext({ plan });
      await createLink(ctx, { url: URL, utmParams }, { ...allowUrl, fetchMetadata: noMetadata });
      expect(inserted[0]).toMatchObject({ utmParams });
    }
  });
});
