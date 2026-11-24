import { describe, expect, test } from "bun:test";

import { limitedAnalyticsCopy } from "./limited-analytics-copy";

const sentence = (hiddenClicks: number) => {
  const { lead, tail } = limitedAnalyticsCopy(hiddenClicks);
  return `${lead} Upgrade to Pro ${tail}`;
};

describe("limitedAnalyticsCopy", () => {
  test("keeps the generic line when no clicks are hidden", () => {
    expect(sentence(0)).toBe(
      "Viewing limited analytics (last 7 days). Upgrade to Pro for full data.",
    );
  });

  test("names a single hidden click in the singular", () => {
    expect(sentence(1)).toBe(
      "1 older click is hidden on Free (last 7 days shown). Upgrade to Pro to see it.",
    );
  });

  test("names many hidden clicks with a grouped count", () => {
    expect(sentence(2)).toBe(
      "2 older clicks are hidden on Free (last 7 days shown). Upgrade to Pro to see all of them.",
    );
    expect(sentence(1284)).toBe(
      "1,284 older clicks are hidden on Free (last 7 days shown). Upgrade to Pro to see all of them.",
    );
    expect(sentence(12_345_678)).toStartWith("12,345,678 older clicks");
  });
});
