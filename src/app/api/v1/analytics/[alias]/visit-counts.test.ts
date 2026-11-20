import { describe, expect, test } from "bun:test";

import { foldVisitCounts } from "./visit-counts";

describe("foldVisitCounts", () => {
  test("builds totals, per-day series and breakdowns from grouped rows", () => {
    const result = foldVisitCounts([
      { dim: "date", k: "2026-11-01", n: 3, v: 1 },
      { dim: "date", k: "2026-11-02", n: 2, v: 0 },
      { dim: "unique", k: "2026-11-01", n: 2, v: 0 },
      { dim: "clicksPerCountry", k: "GH", n: 4, v: 0 },
      { dim: "clicksPerCountry", k: "US", n: 1, v: 0 },
      { dim: "clicksPerBrowser", k: "Chrome", n: 5, v: 0 },
    ]);

    expect(result.totalClicks).toBe(5);
    expect(result.verifiedClicks).toBe(1);
    expect(result.clicksPerDate).toEqual({ "2026-11-01": 3, "2026-11-02": 2 });
    expect(result.verifiedClicksPerDate).toEqual({ "2026-11-01": 1 });
    expect(result.uniqueClicksPerDate).toEqual({ "2026-11-01": 2 });
    expect(result.clicksPerCountry).toEqual({ GH: 4, US: 1 });
    expect(result.clicksPerBrowser).toEqual({ Chrome: 5 });
    expect(result.clicksPerDevice).toEqual({});
  });

  test("ignores unknown dimensions", () => {
    const result = foldVisitCounts([{ dim: "toString", k: "x", n: 1, v: 0 }]);
    expect(result.totalClicks).toBe(0);
  });
});
