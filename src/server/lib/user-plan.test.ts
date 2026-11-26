import { afterAll, beforeEach, describe, expect, test } from "bun:test";

import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

import * as schema from "@/server/db/schema";

import {
  claimMonthlyLinkSlot,
  monthlyLinkLimitMessage,
  releaseMonthlyLinkSlot,
  reserveMonthlyLinkSlot,
} from "./user-plan";

import type { Plan } from "@/lib/billing/plans";

describe("monthlyLinkLimitMessage", () => {
  test("points free users at Pro", () => {
    expect(monthlyLinkLimitMessage("free", 30)).toBe(
      "You've reached your monthly limit of 30 links. Upgrade to Pro for more.",
    );
  });

  test("points Pro users at Ultra", () => {
    expect(monthlyLinkLimitMessage("pro", 1000)).toBe(
      "You've reached your monthly limit of 1,000 links. Upgrade to Ultra for unlimited links.",
    );
  });
});

// The quota is enforced by a conditional UPDATE and row locks, which only a
// real MySQL can exercise. Set TEST_DATABASE_URL to run them; see
// CONTRIBUTING.md, "Database tests".
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("reserveMonthlyLinkSlot (MySQL)", () => {
  const pool = mysql.createPool({ uri: testDatabaseUrl ?? "", connectionLimit: 10 });
  const db = drizzle(pool, { schema, mode: "default" });
  const USER_ID = "user_plan_test_quota";

  async function seedUser(plan: Plan, monthlyLinkCount: number, lastLinkCountReset = new Date()) {
    await db.delete(schema.link).where(eq(schema.link.userId, USER_ID));
    await db.delete(schema.subscription).where(eq(schema.subscription.userId, USER_ID));
    await db.delete(schema.user).where(eq(schema.user.id, USER_ID));
    await db.insert(schema.user).values({ id: USER_ID, monthlyLinkCount, lastLinkCountReset });
    if (plan !== "free") {
      await db.insert(schema.subscription).values({ userId: USER_ID, status: "active", plan });
    }
  }

  async function storedCount() {
    const row = await db.query.user.findFirst({ where: eq(schema.user.id, USER_ID) });
    return row?.monthlyLinkCount;
  }

  // Mirrors POST /api/v1/links: reserve and insert in one transaction.
  function createLink() {
    return db.transaction(async (tx) => {
      await reserveMonthlyLinkSlot(USER_ID, tx);
      await tx.insert(schema.link).values({
        url: "https://example.com",
        alias: crypto.randomUUID().slice(0, 12),
        domain: "ishortn.ink",
        userId: USER_ID,
        createdByUserId: USER_ID,
      });
    });
  }

  async function linkCount() {
    const rows = await db.select().from(schema.link).where(eq(schema.link.userId, USER_ID));
    return rows.length;
  }

  beforeEach(() => seedUser("free", 0));

  afterAll(async () => {
    await seedUser("free", 0);
    await db.delete(schema.user).where(eq(schema.user.id, USER_ID));
    await pool.end();
  });

  test("free users can create 30 links, then get FORBIDDEN", async () => {
    for (let i = 1; i <= 30; i++) {
      await createLink();
      expect(await storedCount()).toBe(i);
    }

    const overLimit = createLink();
    await expect(overLimit).rejects.toBeInstanceOf(TRPCError);
    await expect(overLimit).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: monthlyLinkLimitMessage("free", 30),
    });
    expect(await storedCount()).toBe(30);
    expect(await linkCount()).toBe(30);
  });

  test("the count resets at the start of a new month", async () => {
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    await seedUser("free", 30, lastMonth);

    await createLink();
    expect(await storedCount()).toBe(1);
  });

  test("Pro is capped at 1,000 links", async () => {
    await seedUser("pro", 999);

    await createLink();
    expect(await storedCount()).toBe(1000);
    await expect(createLink()).rejects.toThrow(monthlyLinkLimitMessage("pro", 1000));
  });

  test("Ultra is unlimited and not counted", async () => {
    await seedUser("ultra", 5000);

    await createLink();
    expect(await storedCount()).toBe(5000);
    expect(await linkCount()).toBe(1);
  });

  test("concurrent requests one below the limit create exactly one link", async () => {
    await seedUser("free", 29);

    const results = await Promise.allSettled(Array.from({ length: 8 }, () => createLink()));

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await linkCount()).toBe(1);
    expect(await storedCount()).toBe(30);
  });

  test("concurrent first requests of a new month reset the count only once", async () => {
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    await seedUser("free", 30, lastMonth);

    const results = await Promise.allSettled(Array.from({ length: 8 }, () => createLink()));

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(8);
    expect(await linkCount()).toBe(8);
    expect(await storedCount()).toBe(8);
  });

  test("a failed insert rolls the count back", async () => {
    await seedUser("free", 3);

    const failing = db.transaction(async (tx) => {
      await reserveMonthlyLinkSlot(USER_ID, tx);
      throw new Error("insert failed");
    });

    await expect(failing).rejects.toThrow("insert failed");
    expect(await storedCount()).toBe(3);
  });
});

describe.skipIf(!testDatabaseUrl)("claimMonthlyLinkSlot (MySQL)", () => {
  const pool = mysql.createPool({ uri: testDatabaseUrl ?? "", connectionLimit: 10 });
  const db = drizzle(pool, { schema, mode: "default" });
  const USER_ID = "user_plan_test_claim";
  const lastMonth = () => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date;
  };

  async function seedUser(
    monthlyLinkCount: number,
    lastLinkCountReset: Date | null = new Date(),
    createdAt = new Date(),
  ) {
    await db.delete(schema.link).where(eq(schema.link.userId, USER_ID));
    await db.delete(schema.planLimitHit).where(eq(schema.planLimitHit.userId, USER_ID));
    await db.delete(schema.user).where(eq(schema.user.id, USER_ID));
    await db.insert(schema.user).values({ id: USER_ID, monthlyLinkCount, createdAt });
    // The column defaults to now(), so null has to be written explicitly.
    await db.update(schema.user).set({ lastLinkCountReset }).where(eq(schema.user.id, USER_ID));
  }

  async function storedUser() {
    return db.query.user.findFirst({ where: eq(schema.user.id, USER_ID) });
  }

  // Mirrors createTokenLink: claim, insert, and give the slot back if the insert fails.
  async function createLink(plan: Plan = "free", alias = crypto.randomUUID().slice(0, 12)) {
    await claimMonthlyLinkSlot(USER_ID, plan, db);
    try {
      await db.insert(schema.link).values({
        url: "https://example.com",
        alias,
        domain: "ishortn.ink",
        userId: USER_ID,
        createdByUserId: USER_ID,
      });
    } catch (error) {
      await releaseMonthlyLinkSlot(USER_ID, plan, db);
      throw error;
    }
  }

  async function linkCount() {
    const rows = await db.select().from(schema.link).where(eq(schema.link.userId, USER_ID));
    return rows.length;
  }

  beforeEach(() => seedUser(0));

  afterAll(async () => {
    await seedUser(0);
    await db.delete(schema.user).where(eq(schema.user.id, USER_ID));
    await pool.end();
  });

  test("counts each link until the limit, then refuses with FORBIDDEN and records the hit", async () => {
    await seedUser(28);
    await createLink();
    await createLink();
    expect((await storedUser())?.monthlyLinkCount).toBe(30);

    const overLimit = createLink();
    await expect(overLimit).rejects.toBeInstanceOf(TRPCError);
    await expect(overLimit).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: monthlyLinkLimitMessage("free", 30),
    });
    expect((await storedUser())?.monthlyLinkCount).toBe(30);
    expect(await linkCount()).toBe(2);

    const hits = await db
      .select()
      .from(schema.planLimitHit)
      .where(eq(schema.planLimitHit.userId, USER_ID));
    expect(hits).toMatchObject([{ limitKey: "monthly_links", plan: "free" }]);
  });

  test("concurrent requests one below the limit create exactly one link", async () => {
    await seedUser(29);

    const results = await Promise.allSettled(Array.from({ length: 8 }, () => createLink()));

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await linkCount()).toBe(1);
    expect((await storedUser())?.monthlyLinkCount).toBe(30);
  });

  test("the first create of a new month resets the count to 1", async () => {
    await seedUser(30, lastMonth());

    await createLink();

    const stored = await storedUser();
    expect(stored?.monthlyLinkCount).toBe(1);
    expect(stored!.lastLinkCountReset!.getTime()).toBeGreaterThan(Date.now() - 60_000);
  });

  test("concurrent first requests of a new month reset the count only once", async () => {
    await seedUser(30, lastMonth());

    const results = await Promise.allSettled(Array.from({ length: 8 }, () => createLink()));

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(8);
    expect((await storedUser())?.monthlyLinkCount).toBe(8);
  });

  test("without a reset date, an account from last month starts over", async () => {
    await seedUser(30, null, lastMonth());

    await createLink();
    expect((await storedUser())?.monthlyLinkCount).toBe(1);
  });

  test("without a reset date, an account from this month keeps its count", async () => {
    await seedUser(30, null);

    await expect(createLink()).rejects.toThrow(monthlyLinkLimitMessage("free", 30));
    const stored = await storedUser();
    expect(stored?.monthlyLinkCount).toBe(30);
    expect(stored?.lastLinkCountReset).toBeNull();
  });

  test("a failed insert leaves the count unchanged", async () => {
    await seedUser(3);
    await createLink("free", "claim-dup");

    // The alias is taken, so the insert fails with a duplicate key.
    await expect(createLink("free", "claim-dup")).rejects.toThrow();
    expect((await storedUser())?.monthlyLinkCount).toBe(4);
    expect(await linkCount()).toBe(1);
  });

  test("a failed insert on a new month's first create leaves the month reset", async () => {
    await seedUser(30, lastMonth());
    await db.insert(schema.link).values({
      url: "https://example.com",
      alias: "claim-dup",
      domain: "ishortn.ink",
      userId: USER_ID,
    });

    await expect(createLink("free", "claim-dup")).rejects.toThrow();
    expect((await storedUser())?.monthlyLinkCount).toBe(0);
  });

  test("Ultra is unlimited and not counted", async () => {
    await seedUser(5000);

    await createLink("ultra");
    expect((await storedUser())?.monthlyLinkCount).toBe(5000);
  });
});
