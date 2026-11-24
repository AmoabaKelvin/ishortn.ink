import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mapApiError } from "../src/lib/errors.ts";
import { defaultAutoShorten, qrFileName, usageText } from "../src/lib/format.ts";

describe("mapApiError", () => {
  it("offers an upgrade for 403 with an upgradeUrl", () => {
    const error = mapApiError(403, {
      error: "You've used all 30 links this month.",
      upgradeUrl: "https://ishortn.ink/pricing",
    });
    assert.deepEqual(error, {
      kind: "upgrade",
      message: "You've used all 30 links this month.",
      upgradeUrl: "https://ishortn.ink/pricing",
    });
  });

  it("shows a 403 without upgradeUrl as a plain message", () => {
    const error = mapApiError(403, { error: "Not allowed." });
    assert.equal(error.kind, "invalid");
    assert.equal(error.message, "Not allowed.");
  });

  it("shows the server message for 400", () => {
    const error = mapApiError(400, { error: "That alias is already taken." });
    assert.deepEqual(error, { kind: "invalid", message: "That alias is already taken." });
  });

  it("falls back to a generic message when the body is missing", () => {
    assert.equal(mapApiError(400, null).message, "iShortn couldn't use that link.");
    assert.equal(mapApiError(400, { error: 42 }).message, "iShortn couldn't use that link.");
  });

  it("marks 401 as unauthorized", () => {
    assert.equal(mapApiError(401, { error: "Invalid token" }).kind, "unauthorized");
  });

  it("includes Retry-After for 429", () => {
    assert.deepEqual(mapApiError(429, { error: "Too many requests." }, "30"), {
      kind: "rate_limited",
      message: "Too many requests. Try again in 30 seconds.",
    });
    assert.equal(mapApiError(429, null, "1").message, "Too many requests. Try again in 1 second.");
    assert.equal(mapApiError(429, null, "120").message, "Too many requests. Try again in 2 minutes.");
    assert.equal(mapApiError(429, null, null).message, "Too many requests. Try again in a moment.");
  });

  it("offers a retry for network failures and 5xx", () => {
    assert.equal(mapApiError(0, null).kind, "retry");
    assert.match(mapApiError(0, null).message, /Couldn't reach iShortn/);
    assert.equal(mapApiError(500, { error: "boom" }).kind, "retry");
    assert.equal(mapApiError(503, null).kind, "retry");
  });
});

describe("format helpers", () => {
  it("formats usage with a limit and pluralises", () => {
    assert.equal(usageText(12, 30), "12 of 30 links this month");
    assert.equal(usageText(0, 1), "0 of 1 link this month");
    assert.equal(usageText(1204, 5000), "1,204 of 5,000 links this month");
  });

  it("formats unlimited usage", () => {
    assert.equal(usageText(1, null), "1 link this month");
    assert.equal(usageText(12345, null), "12,345 links this month");
  });

  it("defaults auto-shorten on for paid plans only", () => {
    assert.equal(defaultAutoShorten("free"), false);
    assert.equal(defaultAutoShorten("pro"), true);
    assert.equal(defaultAutoShorten("ultra"), true);
  });

  it("builds a safe QR file name", () => {
    assert.equal(qrFileName("https://ishortn.ink/abc"), "qr-ishortn-ink-abc.png");
    assert.equal(qrFileName("nonsense"), "qr-link.png");
  });
});
