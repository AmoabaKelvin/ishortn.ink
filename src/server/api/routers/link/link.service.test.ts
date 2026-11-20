import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";

import { TRPCError } from "@trpc/server";

import { assertUrlSafe } from "@/server/lib/phishing";

import { updateLink } from "./link.service";

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
  // SAFETY: updateLink only touches ctx.db.query.link.findFirst, ctx.db.transaction,
  // tx.update and ctx.workspace before the write, which is where ReachedWrite stops it.
  const ctx = {
    db: dbWithTransaction,
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
