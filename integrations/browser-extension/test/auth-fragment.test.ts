import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { generateState, parseAuthRedirect } from "../src/lib/auth-fragment.ts";

const REDIRECT = "https://abcdefghijklmnop.chromiumapp.org/";
const STATE = "Zm9vYmFyYmF6cXV4cXV1eGNvcmdlZ3JhdWx0Z2FycGx5";

describe("generateState", () => {
  it("returns 43 URL-safe characters from 32 random bytes", () => {
    const state = generateState();
    assert.equal(state.length, 43);
    assert.match(state, /^[A-Za-z0-9_-]+$/);
  });

  it("maps base64 '+' and '/' to the URL-safe alphabet", () => {
    const state = generateState((bytes) => bytes.fill(0xfb));
    assert.ok(!/[+/=]/.test(state));
    assert.ok(state.includes("-") || state.includes("_"));
  });

  it("differs between calls", () => {
    assert.notEqual(generateState(), generateState());
  });
});

describe("parseAuthRedirect", () => {
  it("returns the token when the state matches", () => {
    const result = parseAuthRedirect(`${REDIRECT}#token=ishortn_ext_abc123&state=${STATE}`, STATE);
    assert.deepEqual(result, { ok: true, token: "ishortn_ext_abc123" });
  });

  it("decodes encoded token characters", () => {
    const result = parseAuthRedirect(`${REDIRECT}#token=a%2Bb%2Fc&state=${STATE}`, STATE);
    assert.deepEqual(result, { ok: true, token: "a+b/c" });
  });

  it("rejects a mismatched state even when a token is present", () => {
    const result = parseAuthRedirect(`${REDIRECT}#token=stolen&state=other-state-value-123`, STATE);
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.reason, "state_mismatch");
  });

  it("rejects a missing state", () => {
    const result = parseAuthRedirect(`${REDIRECT}#token=abc`, STATE);
    assert.equal(!result.ok && result.reason, "state_mismatch");
  });

  it("treats access_denied as a cancel", () => {
    const result = parseAuthRedirect(`${REDIRECT}#error=access_denied&state=${STATE}`, STATE);
    assert.equal(!result.ok && result.reason, "cancelled");
  });

  it("reports other errors generically", () => {
    const result = parseAuthRedirect(`${REDIRECT}#error=server_error&state=${STATE}`, STATE);
    assert.equal(!result.ok && result.reason, "error");
  });

  it("treats an undefined redirect (window closed) as a cancel", () => {
    assert.equal(parseAuthRedirect(undefined, STATE).ok, false);
    const result = parseAuthRedirect(undefined, STATE);
    assert.equal(!result.ok && result.reason, "cancelled");
  });

  it("requires a token on success", () => {
    const result = parseAuthRedirect(`${REDIRECT}#state=${STATE}`, STATE);
    assert.equal(!result.ok && result.reason, "missing_token");
  });

  it("ignores the query string and only reads the fragment", () => {
    const result = parseAuthRedirect(`${REDIRECT}?token=query&state=${STATE}`, STATE);
    assert.equal(result.ok, false);
  });

  it("handles an unparsable URL", () => {
    const result = parseAuthRedirect("not a url", STATE);
    assert.equal(!result.ok && result.reason, "error");
  });
});
