import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { topEntries, windowLabel } from "./analytics.ts";

describe("topEntries", () => {
  test("sorts by clicks, breaks ties by label and keeps the top five", () => {
    const counts = { Ghana: 50, Nigeria: 20, Kenya: 10, Togo: 10, Benin: 5, Mali: 4, Chad: 1 };
    assert.deepEqual(
      topEntries(counts).map((entry) => entry.label),
      ["Ghana", "Nigeria", "Kenya", "Togo", "Benin"],
    );
  });

  test("shares are of the breakdown's own sum", () => {
    assert.deepEqual(topEntries({ mobile: 3, desktop: 1 }), [
      { label: "mobile", clicks: 3, share: "75%" },
      { label: "desktop", clicks: 1, share: "25%" },
    ]);
    assert.equal(topEntries({ a: 999, b: 1 })[1]?.share, "<1%");
  });

  test("an empty breakdown has no entries", () => {
    assert.deepEqual(topEntries({}), []);
    assert.deepEqual(topEntries({ a: 0 }), []);
  });
});

describe("windowLabel", () => {
  test("names the plan's analytics range", () => {
    assert.equal(windowLabel({ days: null, from: null, to: "2026-11-21T00:00:00Z" }), "All time");
    assert.equal(windowLabel({ days: 7, from: "2026-11-14T00:00:00Z", to: "2026-11-21T00:00:00Z" }), "Last 7 days");
  });
});
