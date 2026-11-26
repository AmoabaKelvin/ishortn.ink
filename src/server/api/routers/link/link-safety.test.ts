import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";

import { TRPCError } from "@trpc/server";
import { eq, inArray } from "drizzle-orm";

import { env } from "@/env.mjs";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { parseScrapedPage } from "@/server/lib/metadata";
import { LLM_CHECK_REASON, USER_MSG_UNSAFE } from "@/server/lib/phishing";
import { checkUrlWithLlmAfterResponse } from "@/server/lib/phishing/follow-up";

import { createLink, updateLink } from "./link.service";

import type { WorkspaceTRPCContext } from "../../trpc";
import type { LinkSafetyDeps } from "./link.service";
import type { Plan } from "@/lib/billing/plans";

// Runs against a disposable MySQL with the schema pushed (test/setup.ts points
// the app's db client at it); see CONTRIBUTING.md, "Database tests".
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

const DAY_MS = 24 * 60 * 60 * 1000;

describe.skipIf(!testDatabaseUrl)("dashboard link URL safety checks (MySQL)", () => {
  const USER_ID = "dashboard_link_safety_test";
  const URL_ = "https://studio-copyright-review.cfd/appeal";
  const PASS = { blocked: false, reason: "", userMessage: "" };

  beforeAll(() => {
    if (!env.DATABASE_URL) Object.assign(env, { DATABASE_URL: testDatabaseUrl });
  });

  async function clear() {
    const links = await db
      .select({ id: schema.link.id })
      .from(schema.link)
      .where(eq(schema.link.userId, USER_ID));
    const ids = links.map((l) => l.id);
    if (ids.length > 0) {
      await db.delete(schema.flaggedLink).where(inArray(schema.flaggedLink.linkId, ids));
      await db
        .delete(schema.linkSafetyRecheck)
        .where(inArray(schema.linkSafetyRecheck.linkId, ids));
    }
    await db.delete(schema.link).where(eq(schema.link.userId, USER_ID));
    await db.delete(schema.user).where(eq(schema.user.id, USER_ID));
  }

  /** A personal workspace on `plan` whose owner signed up `ageDays` ago. */
  async function workspace(plan: Plan, ageDays: number): Promise<WorkspaceTRPCContext> {
    await clear();
    await db.insert(schema.user).values({
      id: USER_ID,
      monthlyLinkCount: 0,
      lastLinkCountReset: new Date(),
      createdAt: new Date(Date.now() - ageDays * DAY_MS),
    });
    // SAFETY: createLink and updateLink read only ctx.db, ctx.auth.userId and
    // ctx.workspace; restrictedAt is unset for an unrestricted account.
    return {
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
  }

  type Layers = {
    preChecks: ReturnType<typeof mock>;
    scrape: ReturnType<typeof mock>;
    detect: ReturnType<typeof mock>;
  };

  /** Fake safety layers; `background` resolves once the after-response check has finished. */
  function safety(overrides: Partial<LinkSafetyDeps> = {}) {
    let background: Promise<void> | undefined;
    const layers = {
      preChecks: mock(async () => PASS),
      scrape: mock(async (url: string) =>
        parseScrapedPage("<title>Copyright appeal</title>", url, 200, new Headers()),
      ),
      detect: mock(async (url: string) => ({ url, phishing: false })),
    } satisfies Layers;
    const deps: LinkSafetyDeps = {
      ...layers,
      readVerdict: async () => false,
      rememberVerdict: () => {},
      checkAfterResponse: (...args) => {
        background = checkUrlWithLlmAfterResponse(...args);
        return background;
      },
      ...overrides,
    };
    return { deps, layers, settled: () => background ?? Promise.resolve() };
  }

  const phishing = () => mock(async (url: string) => ({ url, phishing: true }));
  const noMetadata = async () => ({ title: "", description: "", image: "", favicon: "" });

  async function stored(linkId: number) {
    const row = await db.query.link.findFirst({ where: eq(schema.link.id, linkId) });
    const flags = await db
      .select()
      .from(schema.flaggedLink)
      .where(eq(schema.flaggedLink.linkId, linkId));
    return { row, flags };
  }

  beforeEach(clear);
  afterAll(clear);

  describe("createLink", () => {
    test.each([
      ["a paying account", "pro" as const, 1],
      ["a free account older than 7 days", "free" as const, 8],
    ])("creates for %s before the page fetch and LLM run", async (_name, plan, ageDays) => {
      const ctx = await workspace(plan, ageDays);
      const { deps, layers, settled } = safety();
      // Without the fake check, the after-response check never starts, so nothing can scrape.
      const checkAfterResponse = mock(() => Promise.resolve());

      const created = await createLink(
        ctx,
        { url: URL_ },
        { ...deps, checkAfterResponse, fetchMetadata: noMetadata },
      );
      await settled();

      expect(layers.preChecks).toHaveBeenCalledTimes(1);
      expect(layers.scrape).not.toHaveBeenCalled();
      expect(layers.detect).not.toHaveBeenCalled();
      expect(checkAfterResponse).toHaveBeenCalledTimes(1);
      expect(checkAfterResponse.mock.calls[0]).toMatchObject([
        created,
        URL_,
        { account: { plan } },
      ]);
    });

    test("blocks the link afterwards when the LLM flags it on an established free account", async () => {
      const ctx = await workspace("free", 8);
      const { deps, settled } = safety({ detect: phishing() });

      const created = await createLink(ctx, { url: URL_ }, { ...deps, fetchMetadata: noMetadata });
      await settled();

      const { row, flags } = await stored(created.id);
      expect(row?.blocked).toBe(true);
      expect(row?.blockedReason).toBe(LLM_CHECK_REASON);
      expect(flags).toMatchObject([{ reason: LLM_CHECK_REASON, status: "blocked" }]);
    });

    test("flags the link for review when the LLM flags it on a paying account", async () => {
      const ctx = await workspace("pro", 1);
      const { deps, settled } = safety({ detect: phishing() });

      const created = await createLink(ctx, { url: URL_ }, { ...deps, fetchMetadata: noMetadata });
      await settled();

      const { row, flags } = await stored(created.id);
      expect(row?.blocked).toBeFalsy();
      expect(flags).toMatchObject([{ reason: LLM_CHECK_REASON, status: "pending" }]);
    });

    test("refuses before the insert when the LLM flags it on a free account younger than 7 days", async () => {
      const ctx = await workspace("free", 6);
      const checkAfterResponse = mock(() => Promise.resolve());
      const { deps, layers } = safety({ detect: phishing(), checkAfterResponse });

      await expect(
        createLink(ctx, { url: URL_ }, { ...deps, fetchMetadata: noMetadata }),
      ).rejects.toThrow(new TRPCError({ code: "BAD_REQUEST", message: USER_MSG_UNSAFE }));

      expect(layers.scrape).toHaveBeenCalledTimes(1);
      expect(checkAfterResponse).not.toHaveBeenCalled();
      const links = await db.select().from(schema.link).where(eq(schema.link.userId, USER_ID));
      expect(links).toHaveLength(0);
    });

    test("refuses before the insert when a fast layer blocks on an established account", async () => {
      const ctx = await workspace("pro", 30);
      const checkAfterResponse = mock(() => Promise.resolve());
      const { deps } = safety({
        preChecks: mock(async () => ({
          blocked: true,
          reason: "sb",
          userMessage: USER_MSG_UNSAFE,
        })),
        checkAfterResponse,
      });

      await expect(
        createLink(ctx, { url: URL_ }, { ...deps, fetchMetadata: noMetadata }),
      ).rejects.toThrow(new TRPCError({ code: "BAD_REQUEST", message: USER_MSG_UNSAFE }));

      expect(checkAfterResponse).not.toHaveBeenCalled();
      const links = await db.select().from(schema.link).where(eq(schema.link.userId, USER_ID));
      expect(links).toHaveLength(0);
    });
  });

  describe("updateLink", () => {
    const NEW_URL = "https://studio-copyright-review.cfd/appeal-2";

    /** A link created with a passing check, so only the update's check is under test. */
    async function existingLink(ctx: WorkspaceTRPCContext) {
      const { deps, settled } = safety();
      const created = await createLink(ctx, { url: URL_ }, { ...deps, fetchMetadata: noMetadata });
      await settled();
      return created;
    }

    test("blocks the link afterwards when a changed URL is phishing on an established free account", async () => {
      const ctx = await workspace("free", 8);
      const created = await existingLink(ctx);
      const { deps, layers, settled } = safety({ detect: phishing() });

      await updateLink(ctx, { id: created.id, url: NEW_URL }, deps);
      expect(layers.preChecks).toHaveBeenCalledTimes(1);
      await settled();

      const { row, flags } = await stored(created.id);
      expect(row?.url).toBe(NEW_URL);
      expect(row?.blocked).toBe(true);
      expect(flags).toMatchObject([{ reason: LLM_CHECK_REASON, status: "blocked" }]);
    });

    test("flags the link when a changed URL is phishing on a paying account", async () => {
      const ctx = await workspace("pro", 1);
      const created = await existingLink(ctx);
      const { deps, settled } = safety({ detect: phishing() });

      await updateLink(ctx, { id: created.id, url: NEW_URL }, deps);
      await settled();

      const { row, flags } = await stored(created.id);
      expect(row?.url).toBe(NEW_URL);
      expect(row?.blocked).toBeFalsy();
      expect(flags).toMatchObject([{ reason: LLM_CHECK_REASON, status: "pending" }]);
    });

    test("refuses a phishing URL before the write on a free account younger than 7 days", async () => {
      const ctx = await workspace("free", 2);
      const created = await existingLink(ctx);
      const checkAfterResponse = mock(() => Promise.resolve());
      const { deps } = safety({ detect: phishing(), checkAfterResponse });

      await expect(updateLink(ctx, { id: created.id, url: NEW_URL }, deps)).rejects.toThrow(
        new TRPCError({ code: "BAD_REQUEST", message: USER_MSG_UNSAFE }),
      );

      expect(checkAfterResponse).not.toHaveBeenCalled();
      const { row } = await stored(created.id);
      expect(row?.url).toBe(URL_);
    });
  });
});
