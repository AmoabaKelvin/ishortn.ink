import { describe, expect, mock, test } from "bun:test";

import { serializeFirstTouch } from "@/lib/attribution/first-touch";

import { recordAttribution, SIGNUP_ATTRIBUTION_WINDOW_MS } from "./attribution.service";

import type { ProtectedTRPCContext } from "../../trpc";
import type { userAttribution } from "@/server/db/schema";

type AttributionRow = typeof userAttribution.$inferInsert;

const NOW = new Date("2026-11-20T12:00:00Z");
const COOKIE = serializeFirstTouch({
  utm_source: "google",
  utm_medium: "cpc",
  utm_campaign: "test",
  gclid: "abc",
  landingPath: "/compare/bitly",
  referrerHost: "",
  ts: NOW.getTime() - 60_000,
});

function fakeContext(opts: { createdAt: Date | null; hasRow: boolean }) {
  const inserted: AttributionRow[] = [];
  const values = mock(async (row: AttributionRow) => {
    inserted.push(row);
  });
  const db = {
    query: {
      user: { findFirst: async () => ({ createdAt: opts.createdAt }) },
      userAttribution: {
        findFirst: async () => (opts.hasRow ? { userId: "user_1" } : undefined),
      },
    },
    insert: () => ({ ignore: () => ({ values }) }),
  };
  // SAFETY: recordAttribution only touches ctx.auth.userId, ctx.db.query.user,
  // ctx.db.query.userAttribution and ctx.db.insert, all provided above.
  const ctx = { db, auth: { userId: "user_1" } } as ProtectedTRPCContext;
  return { ctx, inserted };
}

describe("recordAttribution", () => {
  test("records a new account's first touch", async () => {
    const { ctx, inserted } = fakeContext({
      createdAt: new Date(NOW.getTime() - 5 * 60_000),
      hasRow: false,
    });
    expect(await recordAttribution(ctx, { cookie: COOKIE }, NOW)).toEqual({ recorded: true });
    expect(inserted).toEqual([
      {
        userId: "user_1",
        utmSource: "google",
        utmMedium: "cpc",
        utmCampaign: "test",
        utmTerm: null,
        utmContent: null,
        clickId: "abc",
        clickIdType: "gclid",
        landingPath: "/compare/bitly",
        referrerHost: null,
        firstSeenAt: new Date(NOW.getTime() - 60_000),
      },
    ]);
  });

  test("never writes a second row", async () => {
    const { ctx, inserted } = fakeContext({ createdAt: NOW, hasRow: true });
    expect(await recordAttribution(ctx, { cookie: COOKIE }, NOW)).toEqual({ recorded: false });
    expect(inserted).toHaveLength(0);
  });

  test("skips accounts older than 24 hours", async () => {
    const { ctx, inserted } = fakeContext({
      createdAt: new Date(NOW.getTime() - SIGNUP_ATTRIBUTION_WINDOW_MS - 1),
      hasRow: false,
    });
    expect(await recordAttribution(ctx, { cookie: COOKIE }, NOW)).toEqual({ recorded: false });
    expect(inserted).toHaveLength(0);
  });

  test("records right at the edge of the window", async () => {
    const { ctx, inserted } = fakeContext({
      createdAt: new Date(NOW.getTime() - SIGNUP_ATTRIBUTION_WINDOW_MS),
      hasRow: false,
    });
    expect(await recordAttribution(ctx, { cookie: COOKIE }, NOW)).toEqual({ recorded: true });
    expect(inserted).toHaveLength(1);
  });

  test("skips accounts without a creation time", async () => {
    const { ctx, inserted } = fakeContext({ createdAt: null, hasRow: false });
    expect(await recordAttribution(ctx, { cookie: COOKIE }, NOW)).toEqual({ recorded: false });
    expect(inserted).toHaveLength(0);
  });

  test("ignores a malformed cookie without touching the database", async () => {
    const { ctx, inserted } = fakeContext({ createdAt: NOW, hasRow: false });
    expect(await recordAttribution(ctx, { cookie: "garbage" }, NOW)).toEqual({ recorded: false });
    expect(inserted).toHaveLength(0);
  });
});
