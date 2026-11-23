import { describe, expect, test } from "bun:test";

import { updateNotificationPreferencesSchema } from "./user.input";

describe("updateNotificationPreferencesSchema", () => {
  test("accepts either setting on its own or both", () => {
    expect(updateNotificationPreferencesSchema.parse({ weeklySummaryEnabled: false })).toEqual({
      weeklySummaryEnabled: false,
    });
    expect(updateNotificationPreferencesSchema.parse({ productEmailsEnabled: true })).toEqual({
      productEmailsEnabled: true,
    });
    expect(
      updateNotificationPreferencesSchema.safeParse({
        productEmailsEnabled: true,
        weeklySummaryEnabled: true,
      }).success,
    ).toBe(true);
  });

  test("rejects an update that changes nothing", () => {
    expect(updateNotificationPreferencesSchema.safeParse({}).success).toBe(false);
  });
});
