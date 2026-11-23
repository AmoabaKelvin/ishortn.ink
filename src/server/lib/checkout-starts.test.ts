import { afterAll, beforeEach, describe, expect, test } from "bun:test";

import { eq } from "drizzle-orm";

import { db } from "@/server/db";
import * as schema from "@/server/db/schema";

import { recordCheckoutStart } from "./checkout-starts";

describe("recordCheckoutStart", () => {
  test("a failing write resolves instead of throwing", async () => {
    const failingDb = {
      insert: () => {
        throw new Error("connection lost");
      },
    };
    const write = recordCheckoutStart(
      { userId: "checkout_start_unit", plan: "pro", interval: "annual", source: "auto_signup" },
      failingDb,
    );
    expect(await write).toBeUndefined();
  });
});

// Set TEST_DATABASE_URL to run; see CONTRIBUTING.md, "Database tests".
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("CheckoutStart logging (MySQL)", () => {
  const USER_ID = "checkout_start_test";

  // Awaited here: a drizzle query only runs when awaited, and the hooks don't await thenables.
  const cleanup = async () => {
    await db.delete(schema.checkoutStart).where(eq(schema.checkoutStart.userId, USER_ID));
  };

  beforeEach(cleanup);
  afterAll(cleanup);

  test("stores the source and the code the checkout was created with", async () => {
    await recordCheckoutStart({
      userId: USER_ID,
      plan: "pro",
      interval: "annual",
      source: "folder_create",
      promoCode: "BFCM20",
    });
    // A checkout whose promo code was rejected and retried without it.
    await recordCheckoutStart({
      userId: USER_ID,
      plan: "ultra",
      interval: "monthly",
      source: "settings_billing",
      promoCode: null,
    });

    const rows = await db
      .select()
      .from(schema.checkoutStart)
      .where(eq(schema.checkoutStart.userId, USER_ID))
      .orderBy(schema.checkoutStart.id);

    expect(
      rows.map(({ plan, interval, source, promoCode }) => ({ plan, interval, source, promoCode })),
    ).toEqual([
      { plan: "pro", interval: "annual", source: "folder_create", promoCode: "BFCM20" },
      { plan: "ultra", interval: "monthly", source: "settings_billing", promoCode: null },
    ]);
  });
});
