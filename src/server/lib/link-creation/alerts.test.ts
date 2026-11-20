import { describe, expect, test } from "bun:test";

import { evaluateLinkCreationAlerts, isAlertDebounced, topErrorCode } from "./alerts";

import type { FailureCount, LinkCreationHealthStats } from "./alerts";

const NOW = new Date("2026-11-20T12:40:00Z");
const HOUR = 60 * 60 * 1000;

function stats(overrides: Partial<LinkCreationHealthStats> = {}): LinkCreationHealthStats {
  return {
    now: NOW,
    linksCreatedLastHour: 0,
    failures: [],
    signupsLastDay: 0,
    signupsWithLinks: 0,
    ...overrides,
  };
}

function failure(overrides: Partial<FailureCount>): FailureCount {
  return {
    step: "db",
    code: "ECONNREFUSED",
    serverError: true,
    lastHour: 0,
    lastDay: 0,
    ...overrides,
  };
}

describe("failure-rate alert", () => {
  test("fires when more than 20% of at least 10 attempts failed server-side", () => {
    const alerts = evaluateLinkCreationAlerts(
      stats({
        linksCreatedLastHour: 7,
        failures: [
          failure({ step: "metadata", code: "TIMEOUT", lastHour: 3, lastDay: 3 }),
          failure({ step: "validation", code: "CONFLICT", serverError: false, lastHour: 1 }),
        ],
      }),
    );

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      kind: "failure-rate",
      topErrorCode: "metadata:TIMEOUT",
      windowStart: new Date(NOW.getTime() - HOUR),
      windowEnd: NOW,
      counts: [
        { label: "Attempts", value: 11 },
        { label: "Server-side failures", value: 3 },
        { label: "All failures", value: 4 },
      ],
    });
  });

  test("stays quiet at exactly 20%", () => {
    const alerts = evaluateLinkCreationAlerts(
      stats({ linksCreatedLastHour: 8, failures: [failure({ lastHour: 2 })] }),
    );
    expect(alerts).toEqual([]);
  });

  test("stays quiet below 10 attempts", () => {
    const alerts = evaluateLinkCreationAlerts(
      stats({ linksCreatedLastHour: 4, failures: [failure({ lastHour: 5 })] }),
    );
    expect(alerts).toEqual([]);
  });

  test("ignores client-side failures", () => {
    const alerts = evaluateLinkCreationAlerts(
      stats({
        linksCreatedLastHour: 5,
        failures: [
          failure({ step: "validation", code: "FORBIDDEN", serverError: false, lastHour: 20 }),
        ],
      }),
    );
    expect(alerts).toEqual([]);
  });
});

describe("signups-without-links alert", () => {
  test("fires when at least 5 signups created no links", () => {
    const alerts = evaluateLinkCreationAlerts(
      stats({
        signupsLastDay: 5,
        signupsWithLinks: 0,
        failures: [failure({ step: "safety", code: "TIMEOUT", lastDay: 6 })],
      }),
    );

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      kind: "signups-without-links",
      topErrorCode: "safety:TIMEOUT",
      windowStart: new Date(NOW.getTime() - 24 * HOUR),
      windowEnd: NOW,
      counts: [
        { label: "Signups", value: 5 },
        { label: "Signups with a link", value: 0 },
        { label: "Failed link creations", value: 6 },
      ],
    });
  });

  test("stays quiet when any new account created a link", () => {
    expect(evaluateLinkCreationAlerts(stats({ signupsLastDay: 12, signupsWithLinks: 1 }))).toEqual(
      [],
    );
  });

  test("stays quiet below 5 signups", () => {
    expect(evaluateLinkCreationAlerts(stats({ signupsLastDay: 4 }))).toEqual([]);
  });

  test("reports no top error code when nothing failed", () => {
    const [alert] = evaluateLinkCreationAlerts(stats({ signupsLastDay: 5 }));
    expect(alert?.topErrorCode).toBeNull();
  });
});

test("both conditions can fire together", () => {
  const alerts = evaluateLinkCreationAlerts(
    stats({ failures: [failure({ lastHour: 10, lastDay: 10 })], signupsLastDay: 5 }),
  );
  expect(alerts.map((a) => a.kind)).toEqual(["failure-rate", "signups-without-links"]);
});

describe("topErrorCode", () => {
  test("prefers server-side failures over more frequent client-side ones", () => {
    expect(
      topErrorCode(
        [
          failure({ step: "validation", code: "CONFLICT", serverError: false, lastHour: 9 }),
          failure({ step: "db", code: "ER_LOCK_WAIT_TIMEOUT", lastHour: 2 }),
          failure({ step: "db", code: "ECONNREFUSED", lastHour: 3 }),
        ],
        "lastHour",
      ),
    ).toBe("db:ECONNREFUSED");
  });

  test("falls back to client-side failures", () => {
    expect(
      topErrorCode(
        [failure({ step: "validation", code: "CONFLICT", serverError: false, lastDay: 2 })],
        "lastDay",
      ),
    ).toBe("validation:CONFLICT");
  });
});

describe("isAlertDebounced", () => {
  test("sends when no alert went out before", () => {
    expect(isAlertDebounced(null, NOW)).toBe(false);
  });

  test("holds a repeat alert within 6 hours", () => {
    expect(isAlertDebounced(new Date(NOW.getTime() - HOUR), NOW)).toBe(true);
    expect(isAlertDebounced(new Date(NOW.getTime() - 6 * HOUR + 1), NOW)).toBe(true);
  });

  test("sends again once 6 hours have passed", () => {
    expect(isAlertDebounced(new Date(NOW.getTime() - 6 * HOUR), NOW)).toBe(false);
  });
});
