import { afterAll, beforeEach, describe, expect, test } from "bun:test";

import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

import * as schema from "@/server/db/schema";

import { monthlyLinkLimitMessage, reserveMonthlyLinkSlot } from "./user-plan";

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
    await db.insert(schema.user).values({
      id: USER_ID,
      email: `${USER_ID}@example.com`,
      monthlyLinkCount,
      lastLinkCountReset,
    });
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
