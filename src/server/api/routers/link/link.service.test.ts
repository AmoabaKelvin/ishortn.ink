import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";

import { TRPCError } from "@trpc/server";

import { assertUrlSafe } from "@/server/lib/phishing";

import { getAllUserAnalytics, updateLink } from "./link.service";

import type { WorkspaceTRPCContext } from "../../trpc";
import type { Mock } from "bun:test";

const EXISTING_URL = "https://example.com/landing";

// Stands in for the DB write so a test can tell the update got past every
// pre-write check without touching a real database.
class ReachedWrite extends Error {}

function fakeContext() {
  const update = mock(() => {
    throw new ReachedWrite();
  });
  const db = {
    query: {
      // A new free account, so a changed URL gets the full check before the write.
      user: { findFirst: async () => ({ createdAt: new Date() }) },
      link: {
        findFirst: async () => ({
          id: 1,
          url: EXISTING_URL,
          alias: "abc",
          domain: "ishortn.ink",
          folderId: null,
        }),
      },
    },
    update,
  };
  // The link write runs in a transaction; the fake one hands back the same db.
  const dbWithTransaction = {
    ...db,
    transaction: async <T>(run: (tx: typeof db) => Promise<T>) => run(db),
  };
  // SAFETY: updateLink only touches ctx.db.query.{link,user}.findFirst, ctx.db.transaction,
  // tx.update, ctx.auth and ctx.workspace before the write, which is where ReachedWrite stops it.
  const ctx = {
    db: dbWithTransaction,
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
  return { ctx, update };
}

describe("updateLink phishing check", () => {
  let fetchSpy: Mock<typeof fetch>;

  beforeEach(() => {
    fetchSpy = spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  test("rejects a changed URL that fails the check, with the create-path error", async () => {
    // An IP-address host is blocked by the deterministic heuristics, before any network call.
    const badUrl = "http://192.168.10.20/login";
    let createError: TRPCError | null = null;
    try {
      await assertUrlSafe(badUrl);
    } catch (error) {
      if (error instanceof TRPCError) createError = error;
    }
    expect(createError).toBeInstanceOf(TRPCError);

    const { ctx, update } = fakeContext();
    let updateError: TRPCError | null = null;
    try {
      await updateLink(ctx, { id: 1, url: badUrl });
    } catch (error) {
      if (error instanceof TRPCError) updateError = error;
    }

    expect(updateError).toBeInstanceOf(TRPCError);
    expect(updateError).toEqual(createError);
    expect(update).not.toHaveBeenCalled();
  });

  test("does not scan when the URL is omitted", async () => {
    const { ctx } = fakeContext();
    await expect(updateLink(ctx, { id: 1, name: "Renamed" })).rejects.toBeInstanceOf(ReachedWrite);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("does not scan when the URL is unchanged", async () => {
    const { ctx } = fakeContext();
    await expect(
      updateLink(ctx, { id: 1, url: EXISTING_URL, name: "Renamed" }),
    ).rejects.toBeInstanceOf(ReachedWrite);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("analytics range plan gating", () => {
  // SAFETY: with no links in the workspace getAllUserAnalytics returns after
  // ctx.db.query.link.findMany, so only that and ctx.workspace are read.
  const contextFor = (plan: "free" | "pro" | "ultra") =>
    ({
      db: { query: { link: { findMany: async () => [] } } },
      workspace: {
        type: "personal",
        userId: "user_1",
        teamId: null,
        teamSlug: null,
        role: "owner",
        plan,
      },
    }) as WorkspaceTRPCContext;

  const custom = { range: "custom", from: "2026-10-05", to: "2026-10-12" } as const;

  test("free plans asking for last month or a custom range get the last 7 days", async () => {
    for (const input of [{ range: "last_month" } as const, custom]) {
      const result = await getAllUserAnalytics(contextFor("free"), {
        ...input,
        filterType: "all",
      });
      expect(result.range).toBe("7d");
      expect(result.custom).toBeNull();
    }
  });

  test("paid plans get the custom range they asked for", async () => {
    for (const plan of ["pro", "ultra"] as const) {
      const result = await getAllUserAnalytics(contextFor(plan), { ...custom, filterType: "all" });
      expect(result.range).toBe("custom");
      expect(result.custom).toEqual({ from: "2026-10-05", to: "2026-10-12" });
      expect(result.window.from).toEqual(new Date("2026-10-05T00:00:00Z"));
      expect(result.window.to).toEqual(new Date("2026-10-12T23:59:59.999Z"));
    }
  });

  test("paid plans get last month", async () => {
    const result = await getAllUserAnalytics(contextFor("pro"), {
      range: "last_month",
      filterType: "all",
    });
    expect(result.range).toBe("last_month");
  });
});
