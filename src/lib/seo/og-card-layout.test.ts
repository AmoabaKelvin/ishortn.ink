import { describe, expect, it } from "bun:test";

import { estimateLines, headlineFontSize } from "./og-card-layout";

describe("estimateLines", () => {
  it("wraps on word boundaries", () => {
    // 10 characters per line at 20px in a 110px column.
    expect(estimateLines("aaaa bbbb cccc", 20, 110)).toBe(2);
    expect(estimateLines("aaaa bbbbb", 20, 110)).toBe(1);
  });

  it("breaks a word longer than the line", () => {
    expect(estimateLines("a".repeat(25), 20, 110)).toBe(3);
  });
});

describe("headlineFontSize", () => {
  it("keeps short titles at the largest size", () => {
    expect(headlineFontSize("Terms of service", 960)).toBe(76);
  });

  it("shrinks long titles until they fit three lines", () => {
    const title =
      "QR Code for a Restaurant Menu: Static vs Dynamic, and How to Update It Without Reprinting";
    const size = headlineFontSize(title, 960);
    expect(size).toBeLessThan(76);
    expect(estimateLines(title, size, 960)).toBeLessThanOrEqual(3);
  });

  it("bottoms out at the smallest size for titles that never fit", () => {
    expect(headlineFontSize("word ".repeat(80), 560)).toBe(48);
  });
});
