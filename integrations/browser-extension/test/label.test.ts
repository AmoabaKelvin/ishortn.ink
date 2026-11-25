import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { browserLabel } from "../src/lib/label.ts";

const UA = {
  chromeMac:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  edgeWin:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
  firefoxLinux: "Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0",
  firefoxMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:133.0) Gecko/20100101 Firefox/133.0",
  operaWin:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 OPR/116.0.0.0",
  chromeOs:
    "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

describe("browserLabel", () => {
  it("names the browser and OS from the user agent", () => {
    assert.equal(browserLabel(UA.chromeMac), "Chrome on macOS");
    assert.equal(browserLabel(UA.edgeWin), "Edge on Windows");
    assert.equal(browserLabel(UA.firefoxLinux), "Firefox on Linux");
    assert.equal(browserLabel(UA.firefoxMac), "Firefox on macOS");
    assert.equal(browserLabel(UA.operaWin), "Opera on Windows");
    assert.equal(browserLabel(UA.chromeOs), "Chrome on ChromeOS");
  });

  it("prefers the platform reported by the extension API", () => {
    assert.equal(browserLabel(UA.chromeMac, "win"), "Chrome on Windows");
    assert.equal(browserLabel(UA.chromeOs, "cros"), "Chrome on ChromeOS");
  });

  it("falls back to the UA when the platform is unknown", () => {
    assert.equal(browserLabel(UA.edgeWin, "fuchsia"), "Edge on Windows");
  });

  it("degrades to a generic label", () => {
    assert.equal(browserLabel(""), "Browser");
  });

  it("stays within 64 characters", () => {
    assert.ok(browserLabel(`${"x".repeat(200)} Firefox/1`).length <= 64);
  });
});
