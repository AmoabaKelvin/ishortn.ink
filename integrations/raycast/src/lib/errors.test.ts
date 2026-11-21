import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  failureFromNetworkError,
  failureFromResponse,
  formatWait,
  IshortnApiError,
  retryAfterSeconds,
  toApiFailure,
} from "./errors.ts";

const NOW_MS = Date.UTC(2026, 10, 21, 12, 0, 0);
const noHeaders = new Headers();
const v1Error = (code: string, message: string) => ({ error: { code, message, details: [] } });

describe("failureFromResponse", () => {
  test("401 is an invalid key", () => {
    const failure = failureFromResponse(401, v1Error("unauthorized", "Invalid or missing API key"), noHeaders, NOW_MS);
    assert.equal(failure.kind, "invalid-key");
    assert.equal(failure.title, "Invalid API key");
  });

  test("the plan gate's string error is a plan failure", () => {
    const body = { error: "API access requires Pro", upgrade_url: "https://ishortn.ink/pricing" };
    const failure = failureFromResponse(403, body, noHeaders, NOW_MS);
    assert.equal(failure.kind, "plan-required");
    assert.equal(failure.title, "API access needs a Pro or Ultra plan");
  });

  test("other 403s keep the API's message", () => {
    const body = v1Error("forbidden", "Domain not available for this API key");
    const failure = failureFromResponse(403, body, noHeaders, NOW_MS);
    assert.deepEqual(failure, {
      kind: "request",
      status: 403,
      title: "Domain not available for this API key",
      message: "",
    });
  });

  test("429 reports the wait from Retry-After", () => {
    const headers = new Headers({ "Retry-After": "42", "X-RateLimit-Reset": String(NOW_MS / 1000 + 600) });
    const failure = failureFromResponse(429, v1Error("rate_limited", "Rate limit exceeded."), headers, NOW_MS);
    assert.equal(failure.kind, "rate-limited");
    assert.equal(failure.message, "Try again in 42 seconds.");
  });

  test("429 falls back to X-RateLimit-Reset", () => {
    const headers = new Headers({ "X-RateLimit-Reset": String(NOW_MS / 1000 + 90) });
    const failure = failureFromResponse(429, null, headers, NOW_MS);
    assert.equal(failure.message, "Try again in 2 minutes.");
  });

  test("5xx hides the server's message", () => {
    const failure = failureFromResponse(500, v1Error("internal_error", "boom"), noHeaders, NOW_MS);
    assert.equal(failure.title, "iShortn is unavailable");
  });

  test("a body that isn't a v1 error still yields a title", () => {
    assert.equal(failureFromResponse(404, null, noHeaders, NOW_MS).title, "Request failed (404)");
    assert.equal(
      failureFromResponse(404, v1Error("not_found", "Link not found"), noHeaders, NOW_MS).title,
      "Link not found",
    );
  });
});

describe("retryAfterSeconds", () => {
  test("never reports less than a second and defaults to a minute", () => {
    assert.equal(retryAfterSeconds(new Headers({ "X-RateLimit-Reset": String(NOW_MS / 1000 - 5) }), NOW_MS), 1);
    assert.equal(retryAfterSeconds(new Headers({ "Retry-After": "soon" }), NOW_MS), 60);
  });
});

describe("formatWait", () => {
  test("rounds up to the largest sensible unit and pluralises", () => {
    assert.equal(formatWait(1), "1 second");
    assert.equal(formatWait(59), "59 seconds");
    assert.equal(formatWait(60), "1 minute");
    assert.equal(formatWait(61), "2 minutes");
    assert.equal(formatWait(3600), "1 hour");
    assert.equal(formatWait(5 * 3600 + 1), "6 hours");
  });
});

describe("network failures", () => {
  test("use the cause of Node's generic fetch error", () => {
    const error = new TypeError("fetch failed", { cause: new Error("getaddrinfo ENOTFOUND ishortn.ink") });
    assert.deepEqual(failureFromNetworkError(error), {
      kind: "network",
      title: "Couldn't reach iShortn",
      message: "getaddrinfo ENOTFOUND ishortn.ink",
    });
  });

  test("toApiFailure unwraps API errors and treats anything else as a network failure", () => {
    const apiFailure = failureFromResponse(401, null, noHeaders, NOW_MS);
    assert.equal(toApiFailure(new IshortnApiError(apiFailure)), apiFailure);
    assert.equal(toApiFailure(new Error("socket hang up")).message, "socket hang up");
  });
});
