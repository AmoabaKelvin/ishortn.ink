import { describe, expect, test } from "bun:test";

import { readableTextOn, resolveBioTheme } from "./theme";

describe("readableTextOn", () => {
  test("returns white text on dark backgrounds", () => {
    expect(readableTextOn("#000000")).toBe("#ffffff");
    expect(readableTextOn("#1a1a1a")).toBe("#ffffff");
    expect(readableTextOn("#6366f1")).toBe("#ffffff");
  });

  test("returns dark text on light backgrounds", () => {
    expect(readableTextOn("#ffffff")).toBe("#0a0a0a");
    expect(readableTextOn("#fafafa")).toBe("#0a0a0a");
  });

  test("handles 3-digit hex and a missing hash", () => {
    expect(readableTextOn("fff")).toBe("#0a0a0a");
    expect(readableTextOn("#000")).toBe("#ffffff");
  });

  test("falls back to white for malformed input", () => {
    expect(readableTextOn("not-a-color")).toBe("#ffffff");
  });
});

describe("resolveBioTheme", () => {
  test("defaults to the minimal preset", () => {
    const t = resolveBioTheme(null);
    expect(t.backgroundCss).toBe("#ffffff");
    expect(t.buttonVariant).toBe("solid");
  });

  test("applies an explicit accent override and computes readable text", () => {
    const t = resolveBioTheme({ preset: "minimal", accentColor: "#ff0000" });
    expect(t.accentColor).toBe("#ff0000");
    expect(t.accentTextColor).toBe("#ffffff");
  });

  test("maps the outline button style to the outline variant", () => {
    const t = resolveBioTheme({ buttonStyle: "outline" });
    expect(t.buttonVariant).toBe("outline");
  });

  test("maps pill style to a full radius", () => {
    expect(resolveBioTheme({ buttonStyle: "pill" }).buttonRadius).toBe("9999px");
  });

  test("renders a custom gradient background", () => {
    const t = resolveBioTheme({ background: { type: "gradient", from: "#111111", to: "#222222" } });
    expect(t.backgroundCss).toContain("linear-gradient");
    expect(t.backgroundCss).toContain("#111111");
  });

  test("uses a custom solid background color", () => {
    const t = resolveBioTheme({ background: { type: "solid", color: "#abcdef" } });
    expect(t.backgroundCss).toBe("#abcdef");
  });
});
