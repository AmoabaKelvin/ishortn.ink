import { describe, expect, it } from "bun:test";

import { summarizeTargeting } from "./targeting-summary";

describe("summarizeTargeting", () => {
  it("returns null for a link without rules", () => {
    expect(summarizeTargeting([])).toBeNull();
  });

  it("groups OS and device rules as device rules", () => {
    expect(summarizeTargeting(["os"])).toEqual({ kinds: ["device"], label: "Device rules" });
    expect(summarizeTargeting(["device", "os"])).toEqual({
      kinds: ["device"],
      label: "Device rules",
    });
  });

  it("groups country and continent rules as location rules", () => {
    expect(summarizeTargeting(["continent", "country"])).toEqual({
      kinds: ["location"],
      label: "Location rules",
    });
  });

  it("names both kinds when a link has both", () => {
    expect(summarizeTargeting(["country", "os"])).toEqual({
      kinds: ["device", "location"],
      label: "Device and location rules",
    });
  });
});
