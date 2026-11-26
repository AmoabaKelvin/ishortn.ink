import { describe, expect, it } from "bun:test";

import { safetyMessage, splitUrl } from "./utils";

describe("safetyMessage", () => {
  it("names each threat Safe Browsing reports", () => {
    expect(safetyMessage({ status: "unsafe", threats: ["phishing"] })).toBe(
      "Google Safe Browsing flags this link as phishing. Don't open it.",
    );
    expect(safetyMessage({ status: "unsafe", threats: ["phishing", "malware"] })).toBe(
      "Google Safe Browsing flags this link as phishing and malware. Don't open it.",
    );
  });

  it("says no known threats for a clean result", () => {
    expect(safetyMessage({ status: "safe" })).toBe(
      "No known threats found by Google Safe Browsing",
    );
  });
});

describe("splitUrl", () => {
  it("separates the domain from the rest of the address", () => {
    expect(splitUrl("https://shop.example.com:8443/a?b=c")).toEqual({
      scheme: "https://",
      host: "shop.example.com:8443",
      rest: "/a?b=c",
    });
  });

  it("returns anything else whole", () => {
    expect(splitUrl("not a url")).toEqual({ scheme: "", host: "", rest: "not a url" });
  });
});
