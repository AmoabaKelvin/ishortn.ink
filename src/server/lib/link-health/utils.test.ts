import { describe, expect, test } from "bun:test";

import { hostLanes, needsAlert, nextLinkHealth, type LinkHealthState } from "./utils";

import type { CheckResult } from "./check";

const day = (n: number) => new Date(Date.UTC(2026, 10, n, 7));
const ok: CheckResult = { kind: "ok", status: 200 };
const notFound: CheckResult = { kind: "failure", status: 404, error: null };
const dns: CheckResult = { kind: "failure", status: null, error: "dns_failure" };
const ignored: CheckResult = { kind: "inconclusive" };

const run = (results: CheckResult[], start: LinkHealthState | null = null) =>
  results.reduce<LinkHealthState | null>(
    (state, result, index) => nextLinkHealth(state, result, day(index + 1)),
    start,
  );

describe("nextLinkHealth", () => {
  test("one failure is not broken; the second in a row is", () => {
    const first = run([notFound]);
    expect(first).toMatchObject({ consecutiveFailures: 1, brokenSince: null, lastStatus: 404 });
    expect(needsAlert(first!)).toBe(false);

    const second = nextLinkHealth(first, dns, day(2));
    expect(second).toMatchObject({
      consecutiveFailures: 2,
      brokenSince: day(2),
      lastStatus: null,
      lastError: "dns_failure",
    });
    expect(needsAlert(second)).toBe(true);
  });

  test("403/429 and challenges don't count, and don't break the streak either", () => {
    expect(run([ignored, ignored, ignored])).toMatchObject({
      consecutiveFailures: 0,
      brokenSince: null,
      lastCheckedAt: day(3),
    });
    const state = run([notFound, ignored]);
    expect(state).toMatchObject({ consecutiveFailures: 1, brokenSince: null, lastStatus: 404 });
    expect(nextLinkHealth(state, notFound, day(3)).brokenSince).toEqual(day(3));
  });

  test("one success clears the failures, the outage and the alert", () => {
    const broken = run([notFound, notFound]);
    const alerted = { ...broken!, alertedAt: day(2) };
    expect(nextLinkHealth(alerted, ok, day(3))).toEqual({
      lastCheckedAt: day(3),
      lastStatus: 200,
      lastError: null,
      consecutiveFailures: 0,
      brokenSince: null,
      alertedAt: null,
    });
    expect(run([notFound, ok, notFound])).toMatchObject({ consecutiveFailures: 1 });
  });

  test("an alerted outage doesn't alert again until it recovers and breaks again", () => {
    const alerted = { ...run([notFound, notFound])!, alertedAt: day(2) };
    const stillDown = nextLinkHealth(alerted, dns, day(3));
    expect(stillDown).toMatchObject({ brokenSince: day(2), alertedAt: day(2) });
    expect(needsAlert(stillDown)).toBe(false);

    const again = run([ok, notFound, notFound], stillDown);
    expect(again).toMatchObject({ brokenSince: day(3), alertedAt: null });
    expect(needsAlert(again!)).toBe(true);
  });
});

describe("hostLanes", () => {
  test("no host gets more than the per-host limit of lanes", () => {
    const items = ["a.com/1", "a.com/2", "a.com/3", "b.com/1", "not a url"].map((path) => ({
      url: path.includes(" ") ? path : `https://${path}`,
    }));
    const lanes = hostLanes(items, 2);
    expect(lanes.map((lane) => lane.map((item) => item.url))).toEqual([
      ["https://a.com/1", "https://a.com/3"],
      ["https://a.com/2"],
      ["https://b.com/1"],
      ["not a url"],
    ]);
  });
});
