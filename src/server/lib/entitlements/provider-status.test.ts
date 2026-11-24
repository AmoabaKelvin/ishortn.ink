import { describe, expect, test } from "bun:test";

import { providerEndedSubscription } from "./provider-status";

const NOW = new Date("2026-11-20T12:00:00Z");
const state = (status: string, endsAt: Date | null) => ({ status, endsAt, updatedAt: null });
const PAST = new Date("2026-11-10T00:00:00Z");
const FUTURE = new Date("2026-12-10T00:00:00Z");

describe("providerEndedSubscription", () => {
  test.each(["active", "on_trial", "past_due", "unpaid"])(
    "an expired subscription has ended for a local %s row",
    (local) => {
      expect(providerEndedSubscription(local, state("expired", PAST), NOW)).toBe(true);
      expect(providerEndedSubscription(local, state("expired", null), NOW)).toBe(true);
    },
  );

  test("a cancelled paid subscription ends only once ends_at has passed", () => {
    expect(providerEndedSubscription("active", state("cancelled", PAST), NOW)).toBe(true);
    expect(providerEndedSubscription("active", state("cancelled", FUTURE), NOW)).toBe(false);
    expect(providerEndedSubscription("active", state("cancelled", null), NOW)).toBe(false);
  });

  test("a cancelled failed renewal has ended whatever its ends_at", () => {
    expect(providerEndedSubscription("unpaid", state("cancelled", FUTURE), NOW)).toBe(true);
  });

  test.each(["active", "past_due", "unpaid", "paused", "on_trial"])(
    "a %s subscription at the provider has not ended",
    (status) => {
      expect(providerEndedSubscription("active", state(status, PAST), NOW)).toBe(false);
    },
  );
});
