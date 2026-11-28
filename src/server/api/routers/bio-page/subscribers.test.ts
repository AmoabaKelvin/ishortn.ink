import { afterAll, beforeEach, describe, expect, test } from "bun:test";

import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

import { serializeEmailCapture } from "@/components/bio/email-capture";
import * as schema from "@/server/db/schema";
import { clearPlanLimitHitMemo } from "@/server/lib/plan-limit-hits";

import {
  addBlock,
  BIO_SUBSCRIBE_RATE_LIMIT,
  deleteBioPage,
  deleteSubscriber,
  exportSubscribers,
  getPublicBioPageBySlug,
  listSubscribers,
  subscribeToBioPage,
} from "./bio-page.service";

import type { PublicTRPCContext, WorkspaceTRPCContext } from "../../trpc";
import type { CounterStore } from "@/app/api/v1/rate-limit";
import type { Plan } from "@/lib/billing/plans";

// Exercises the signup flow against a real MySQL. Set TEST_DATABASE_URL to run
// it; see CONTRIBUTING.md, "Database tests".
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

const memoryStore = (): CounterStore => {
  const values = new Map<string, string>();
  return {
    get: async (keys) => new Map(keys.map((key) => [key, values.get(key) ?? null])),
    put: async (key, value) => {
      values.set(key, value);
    },
  };
};

describe.skipIf(!testDatabaseUrl)("bio page subscribers (MySQL)", () => {
  const pool = mysql.createPool({ uri: testDatabaseUrl ?? "", connectionLimit: 5 });
  const db = drizzle(pool, { schema, mode: "default" });

  const USER_ID = "bio_subscribers_test";
  const OTHER_USER_ID = "bio_subscribers_other";
  const SLUG = "bio-subscribers-service-test";

  let pageId = 0;
  let blockId = 0;

  function ctx(plan: Plan, userId = USER_ID) {
    // SAFETY: mirrors what workspaceProcedure resolves for a personal workspace.
    return {
      db,
      auth: { userId },
      workspace: { type: "personal", userId, teamId: null, teamSlug: null, role: "owner", plan },
    } as WorkspaceTRPCContext;
  }

  // Each call gets its own visitor and counter store, so the limiter's
  // per-isolate counts never leak between tests.
  function subscribe(input: Partial<Parameters<typeof subscribeToBioPage>[1]>, ipHash?: string) {
    const pending: Promise<unknown>[] = [];
    return subscribeToBioPage(
      db,
      { blockId, email: "ana@example.com", ...input },
      {
        ipHash: ipHash ?? crypto.randomUUID(),
        store: memoryStore(),
        defer: (task) => void pending.push(task),
      },
    );
  }

  const subscriberRows = () =>
    db.select().from(schema.bioSubscriber).where(eq(schema.bioSubscriber.bioPageId, pageId));

  async function cleanup() {
    const pages = await db.query.bioPage.findMany({
      where: inArray(schema.bioPage.userId, [USER_ID, OTHER_USER_ID]),
    });
    const pageIds = pages.map((p) => p.id);
    if (pageIds.length) {
      await db.delete(schema.bioBlock).where(inArray(schema.bioBlock.bioPageId, pageIds));
      await db.delete(schema.bioSubscriber).where(inArray(schema.bioSubscriber.bioPageId, pageIds));
    }
    await db.delete(schema.bioPage).where(inArray(schema.bioPage.userId, [USER_ID, OTHER_USER_ID]));
    await db.delete(schema.user).where(inArray(schema.user.id, [USER_ID, OTHER_USER_ID]));
  }

  beforeEach(async () => {
    await cleanup();
    clearPlanLimitHitMemo();
    await db.insert(schema.user).values([{ id: USER_ID }, { id: OTHER_USER_ID }]);
    const [page] = await db
      .insert(schema.bioPage)
      .values({ userId: USER_ID, slug: SLUG, title: "Ana's Bakery", isPublished: true });
    pageId = Number(page.insertId);
    const [block] = await db.insert(schema.bioBlock).values({
      bioPageId: pageId,
      type: "email_capture",
      title: "Get the weekly menu",
      content: serializeEmailCapture({ buttonLabel: "Join", successMessage: "", consentText: "" }),
      position: 0,
    });
    blockId = Number(block.insertId);
  });

  afterAll(async () => {
    await cleanup();
    await pool.end();
  });

  describe("subscribe", () => {
    test("stores a valid address, lowercased", async () => {
      expect(await subscribe({ email: "  Ana@Example.com " })).toEqual({ ok: true });
      const rows = await subscriberRows();
      expect(rows.map((r) => r.email)).toEqual(["ana@example.com"]);
    });

    test("a duplicate signup succeeds without a second row", async () => {
      expect(await subscribe({})).toEqual({ ok: true });
      expect(await subscribe({ email: "ANA@example.com" })).toEqual({ ok: true });
      expect(await subscriberRows()).toHaveLength(1);
    });

    test("an invalid address is refused and stores nothing", async () => {
      const result = await subscribe({ email: "ana@" });
      expect(result).toMatchObject({ ok: false, status: 400 });
      expect(await subscriberRows()).toHaveLength(0);
    });

    test("a filled honeypot looks like success but stores nothing", async () => {
      expect(await subscribe({ website: "https://spam.example" })).toEqual({ ok: true });
      expect(await subscriberRows()).toHaveLength(0);
    });

    test("one visitor is rate limited after the window's allowance", async () => {
      const store = memoryStore();
      const pending: Promise<unknown>[] = [];
      const options = {
        ipHash: `ip-${crypto.randomUUID()}`,
        store,
        defer: (task: Promise<unknown>) => void pending.push(task),
        // The start of a window, so the previous window carries no weight.
        nowMs: 600_000 * 4_000_000,
      };
      for (let i = 0; i < BIO_SUBSCRIBE_RATE_LIMIT.limit; i++) {
        const result = await subscribeToBioPage(
          db,
          { blockId, email: `visitor${i}@example.com` },
          options,
        );
        expect(result).toEqual({ ok: true });
        await Promise.all(pending);
      }
      const blocked = await subscribeToBioPage(
        db,
        { blockId, email: "one-more@example.com" },
        options,
      );
      expect(blocked).toMatchObject({ ok: false, status: 429 });
      expect(blocked.ok ? 0 : blocked.retryAfter).toBeGreaterThan(0);
      expect(await subscriberRows()).toHaveLength(BIO_SUBSCRIBE_RATE_LIMIT.limit);
    });

    test("consent text makes the checkbox required", async () => {
      await db
        .update(schema.bioBlock)
        .set({
          content: serializeEmailCapture({
            buttonLabel: "",
            successMessage: "",
            consentText: "I agree to receive emails from Ana's Bakery.",
          }),
        })
        .where(eq(schema.bioBlock.id, blockId));

      expect(await subscribe({})).toMatchObject({ ok: false, status: 400 });
      expect(await subscribe({ consent: true })).toEqual({ ok: true });
      expect(await subscriberRows()).toHaveLength(1);
    });

    test("unpublished pages and hidden blocks don't take signups", async () => {
      await db
        .update(schema.bioPage)
        .set({ isPublished: false })
        .where(eq(schema.bioPage.id, pageId));
      expect(await subscribe({})).toMatchObject({ ok: false, status: 404 });

      await db
        .update(schema.bioPage)
        .set({ isPublished: true })
        .where(eq(schema.bioPage.id, pageId));
      await db
        .update(schema.bioBlock)
        .set({ isVisible: false })
        .where(eq(schema.bioBlock.id, blockId));
      expect(await subscribe({})).toMatchObject({ ok: false, status: 404 });
      expect(await subscriberRows()).toHaveLength(0);
    });
  });

  test("the public page carries the block's settings with defaults filled in", async () => {
    // SAFETY: getPublicBioPageBySlug only reads ctx.db.
    const page = await getPublicBioPageBySlug({ db } as PublicTRPCContext, SLUG);
    expect(page?.blocks).toEqual([
      {
        id: blockId,
        type: "email_capture",
        heading: "Get the weekly menu",
        buttonLabel: "Join",
        successMessage: "Thanks for subscribing!",
        consentText: null,
      },
    ]);
  });

  describe("plan limit", () => {
    test("Free can add one signup block per page; Pro can add more", async () => {
      await expect(
        addBlock(ctx("free"), { bioPageId: pageId, type: "email_capture" }),
      ).rejects.toThrow("The free plan allows 1 email signup block per bio page.");

      const { id } = await addBlock(ctx("pro"), {
        bioPageId: pageId,
        type: "email_capture",
        title: "Second form",
        emailCapture: { buttonLabel: "Go", successMessage: "Done", consentText: "" },
      });
      const block = await db.query.bioBlock.findFirst({ where: eq(schema.bioBlock.id, id) });
      expect(block?.type).toBe("email_capture");
      expect(block?.title).toBe("Second form");
    });
  });

  describe("dashboard", () => {
    async function seedSubscribers() {
      await db.insert(schema.bioSubscriber).values([
        {
          bioPageId: pageId,
          email: "old@example.com",
          createdAt: new Date("2026-11-01T08:00:00Z"),
        },
        {
          bioPageId: pageId,
          email: "new@example.com",
          createdAt: new Date("2026-11-20T09:30:00Z"),
        },
        {
          bioPageId: pageId,
          email: "mid@example.com",
          createdAt: new Date("2026-11-10T12:00:00Z"),
        },
      ]);
    }

    test("lists newest first, paginated, with the total", async () => {
      await seedSubscribers();
      const first = await listSubscribers(ctx("free"), { bioPageId: pageId, page: 1, pageSize: 2 });
      expect(first.total).toBe(3);
      expect(first.items.map((s) => s.email)).toEqual(["new@example.com", "mid@example.com"]);
      const second = await listSubscribers(ctx("free"), {
        bioPageId: pageId,
        page: 2,
        pageSize: 2,
      });
      expect(second.items.map((s) => s.email)).toEqual(["old@example.com"]);
    });

    test("exports a CSV of email and signup time on the Free plan", async () => {
      await seedSubscribers();
      const result = await exportSubscribers(ctx("free"), pageId);
      expect(result.rowCount).toBe(3);
      expect(result.truncated).toBe(false);
      expect(result.csv).toBe(
        [
          "Email,Signed up at (UTC)",
          '"new@example.com","2026-11-20 09:30:00"',
          '"mid@example.com","2026-11-10 12:00:00"',
          '"old@example.com","2026-11-01 08:00:00"',
          "",
        ].join("\r\n"),
      );
    });

    test("another workspace can't read, export or delete the list", async () => {
      await seedSubscribers();
      const [row] = await subscriberRows();
      await expect(
        listSubscribers(ctx("pro", OTHER_USER_ID), { bioPageId: pageId, page: 1, pageSize: 25 }),
      ).rejects.toThrow("Bio page not found.");
      await expect(exportSubscribers(ctx("pro", OTHER_USER_ID), pageId)).rejects.toThrow(
        "Bio page not found.",
      );
      await expect(deleteSubscriber(ctx("pro", OTHER_USER_ID), row!.id)).rejects.toThrow(
        "Subscriber not found.",
      );
      expect(await subscriberRows()).toHaveLength(3);
    });

    test("the owner can delete a subscriber", async () => {
      await seedSubscribers();
      const [row] = await subscriberRows();
      await deleteSubscriber(ctx("free"), row!.id);
      expect(await subscriberRows()).toHaveLength(2);
    });

    test("deleting the page deletes its subscribers", async () => {
      await seedSubscribers();
      await deleteBioPage(ctx("free"), pageId);
      expect(await subscriberRows()).toHaveLength(0);
    });
  });
});
