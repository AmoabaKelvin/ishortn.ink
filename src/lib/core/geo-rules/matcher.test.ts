import { describe, expect, test } from "bun:test";

import { matchTargetingRules, rulesNeedDevice } from "./matcher";

import type { GeoRule } from "@/server/db/schema";

let nextId = 1;
function rule(overrides: Partial<GeoRule>): GeoRule {
  return {
    id: nextId++,
    linkId: 1,
    type: "country",
    condition: "in",
    values: [],
    action: "redirect",
    destination: "https://example.com/alt",
    blockMessage: null,
    priority: 0,
    createdAt: null,
    ...overrides,
  };
}

const visitor = (v: Partial<{ country: string; device: string; os: string }>) => ({
  country: v.country ?? null,
  device: v.device ?? null,
  os: v.os ?? null,
});

describe("matchTargetingRules", () => {
  test("os rule routes iOS to its destination", () => {
    const rules = [rule({ type: "os", values: ["ios"], destination: "https://apps.apple.com/x" })];
    const result = matchTargetingRules(rules, visitor({ os: "iOS", device: "mobile" }));
    expect(result).toMatchObject({
      matched: true,
      action: "redirect",
      destination: "https://apps.apple.com/x",
    });
  });

  test("os aliases fold onto canonical keys", () => {
    const rules = [rule({ type: "os", values: ["macos", "linux"] })];
    expect(matchTargetingRules(rules, visitor({ os: "Mac OS" })).matched).toBe(true);
    expect(matchTargetingRules(rules, visitor({ os: "Ubuntu" })).matched).toBe(true);
    expect(matchTargetingRules(rules, visitor({ os: "Windows" })).matched).toBe(false);
  });

  test("device rule matches case-insensitively against parser output", () => {
    const rules = [rule({ type: "device", values: ["desktop"] })];
    expect(matchTargetingRules(rules, visitor({ device: "Desktop" })).matched).toBe(true);
    expect(matchTargetingRules(rules, visitor({ device: "mobile" })).matched).toBe(false);
  });

  test("not_in inverts only when the dimension is known", () => {
    const rules = [rule({ type: "device", condition: "not_in", values: ["mobile"] })];
    expect(matchTargetingRules(rules, visitor({ device: "tablet" })).matched).toBe(true);
    expect(matchTargetingRules(rules, visitor({ device: "mobile" })).matched).toBe(false);
    expect(matchTargetingRules(rules, visitor({})).matched).toBe(false);
  });

  test("country rules still work without device data, and vice versa", () => {
    const rules = [
      rule({ type: "country", values: ["DE"], priority: 0 }),
      rule({
        type: "os",
        values: ["android"],
        priority: 1,
        destination: "https://play.google.com/x",
      }),
    ];
    expect(matchTargetingRules(rules, visitor({ country: "DE" }))).toMatchObject({
      matched: true,
      destination: "https://example.com/alt",
    });
    expect(matchTargetingRules(rules, visitor({ os: "Android" }))).toMatchObject({
      matched: true,
      destination: "https://play.google.com/x",
    });
  });

  test("priority order decides when several rules match", () => {
    const rules = [
      rule({ type: "os", values: ["ios"], priority: 5, destination: "https://second" }),
      rule({ type: "device", values: ["mobile"], priority: 1, destination: "https://first" }),
    ];
    expect(matchTargetingRules(rules, visitor({ os: "iOS", device: "mobile" }))).toMatchObject({
      destination: "https://first",
    });
  });

  test("block rules surface their message", () => {
    const rules = [
      rule({ type: "os", values: ["windows"], action: "block", blockMessage: "Mac only" }),
    ];
    expect(matchTargetingRules(rules, visitor({ os: "Windows" }))).toMatchObject({
      matched: true,
      action: "block",
      message: "Mac only",
    });
  });
});

describe("rulesNeedDevice", () => {
  test("is true only when a device or os rule exists", () => {
    expect(rulesNeedDevice([rule({ type: "country", values: ["US"] })])).toBe(false);
    expect(rulesNeedDevice([rule({ type: "os", values: ["ios"] })])).toBe(true);
    expect(rulesNeedDevice(null)).toBe(false);
  });
});
