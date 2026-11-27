import { describe, expect, test } from "bun:test";

import { checkTrackingLinkQuota, insertHiddenTrackingLink } from "./index";

import type { Plan } from "@/lib/billing/plans";
import type { WorkspaceTRPCContext } from "@/server/api/trpc";
import type { db } from "@/server/db";

type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

const USER_ID = "user_1";

// A personal workspace whose user has made 5 links this month, backed by an
// in-memory user row so the test can read monthlyLinkCount after the insert.
function fakeWorkspace(plan: Plan) {
  const userRow = {
    id: USER_ID,
    monthlyLinkCount: 5,
    lastLinkCountReset: new Date(),
    createdAt: new Date(),
    subscriptions:
      plan === "free" ? null : { status: "active", plan, variantId: null, productId: null },
  };
  const db = {
    query: { user: { findFirst: async () => userRow } },
    insert: () => ({ values: async () => [{ insertId: 42 }] }),
    update: () => ({
      set: (values: { monthlyLinkCount: number }) => ({
        where: async () => {
          userRow.monthlyLinkCount = values.monthlyLinkCount;
        },
      }),
    }),
  };
  // SAFETY: checkTrackingLinkQuota and insertHiddenTrackingLink only touch
  // ctx.auth, ctx.workspace, db.query.user.findFirst, db.insert and db.update,
  // all provided above.
  const ctx = {
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
  return { ctx, userRow };
}

// The quota half of prepareHiddenTrackingLink followed by the real insert; the
// rest of prepare (URL scan, domain, alias) doesn't touch the monthly count.
async function addBioLink(plan: Plan, kind: "bio" | "bio-image" = "bio") {
  const { ctx, userRow } = fakeWorkspace(plan);
  const quota = await checkTrackingLinkQuota(ctx, kind);
  const prepared = {
    ...quota,
    values: {
      url: "https://example.com/shop",
      alias: "abc123",
      domain: "ishortn.ink",
      userId: USER_ID,
    },
    trackingUrl: "https://ishortn.ink/abc123",
    alias: "abc123",
    domain: "ishortn.ink",
  };
  // SAFETY: insertHiddenTrackingLink only calls insert/update, which the fake db provides.
  await insertHiddenTrackingLink(ctx.db as TransactionClient, ctx, prepared);
  return userRow.monthlyLinkCount;
}

describe("bio tracking links and the monthly link quota", () => {
  test("a free bio link doesn't increment the monthly link count", async () => {
    expect(await addBioLink("free")).toBe(5);
  });

  test("a Pro bio link increments the monthly link count", async () => {
    expect(await addBioLink("pro")).toBe(6);
  });

  test("an image block's link doesn't increment the monthly link count on Pro or Ultra", async () => {
    expect(await addBioLink("pro", "bio-image")).toBe(5);
    expect(await addBioLink("ultra", "bio-image")).toBe(5);
  });

  test("a QR tracking link on the free plan still increments the monthly link count", async () => {
    const { ctx, userRow } = fakeWorkspace("free");
    expect(await checkTrackingLinkQuota(ctx, "qr")).toEqual({
      currentCount: 5,
      shouldIncrementCount: true,
    });
    expect(userRow.monthlyLinkCount).toBe(5);
  });
});
