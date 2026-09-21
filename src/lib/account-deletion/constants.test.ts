import { describe, expect, test } from "bun:test";

import { DELETION_CASCADE_REASON, DELETION_GRACE_PERIOD_DAYS, purgeDateFor } from "./constants";

describe("purgeDateFor", () => {
  test("lands the grace period after the deletion date", () => {
    const deletedAt = new Date("2026-01-01T10:30:00.000Z");
    const purgeAt = purgeDateFor(deletedAt);

    const days = (purgeAt.getTime() - deletedAt.getTime()) / 86_400_000;
    expect(days).toBe(DELETION_GRACE_PERIOD_DAYS);
  });

  test("crosses month and year boundaries", () => {
    // 2026-12-15 + 30d = 2027-01-14, and February gets its real length.
    expect(purgeDateFor(new Date("2026-12-15T00:00:00.000Z")).toISOString()).toStartWith(
      "2027-01-14",
    );
    expect(purgeDateFor(new Date("2026-02-01T00:00:00.000Z")).toISOString()).toStartWith(
      "2026-03-03",
    );
  });

  test("does not mutate the date it is given", () => {
    const deletedAt = new Date("2026-01-01T00:00:00.000Z");
    purgeDateFor(deletedAt);
    expect(deletedAt.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("DELETION_CASCADE_REASON", () => {
  // Restore only un-blocks links carrying this exact string, so a drift here
  // would silently strand every link of a restored account.
  test("is the exact sentinel restore matches on", () => {
    expect(DELETION_CASCADE_REASON).toBe("Owner account deleted");
  });
});
