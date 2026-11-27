import { describe, expect, test } from "bun:test";
import crypto from "node:crypto";

import { verifyPaddleSignature } from "./webhook";

const SECRET = "pdl_ntfset_01h_test_secret";
const BODY = '{"event_type":"subscription.updated","data":{"id":"sub_01"}}';
const TS = 1_764_201_600; // 2025-11-27T00:00:00Z
const NOW = TS * 1000;

function sign(body: string, ts: number, secret = SECRET) {
  return crypto.createHmac("sha256", secret).update(`${ts}:${body}`).digest("hex");
}

describe("verifyPaddleSignature", () => {
  test("fixed vector", () => {
    const body = '{"a":1}';
    // HMAC-SHA256("secret", '1700000000:{"a":1}'), computed independently.
    const expected = "4f0bff5cd8903c8149837f5187dd1ebbb1ba3fe7acd2a8b61cb3fb91e509a6ad";
    expect(sign(body, 1_700_000_000, "secret")).toBe(expected);
    expect(
      verifyPaddleSignature(body, `ts=1700000000;h1=${expected}`, "secret", 1_700_000_000_000),
    ).toEqual({ ok: true });
  });

  test("a valid signature passes, including within the 5s tolerance either way", () => {
    const header = `ts=${TS};h1=${sign(BODY, TS)}`;
    expect(verifyPaddleSignature(BODY, header, SECRET, NOW)).toEqual({ ok: true });
    expect(verifyPaddleSignature(BODY, header, SECRET, NOW + 5_000)).toEqual({ ok: true });
    expect(verifyPaddleSignature(BODY, header, SECRET, NOW - 5_000)).toEqual({ ok: true });
  });

  test("a tampered body or wrong secret fails", () => {
    const header = `ts=${TS};h1=${sign(BODY, TS)}`;
    expect(verifyPaddleSignature(`${BODY} `, header, SECRET, NOW)).toEqual({
      ok: false,
      reason: "signature_mismatch",
    });
    expect(verifyPaddleSignature(BODY, header, "other_secret", NOW)).toEqual({
      ok: false,
      reason: "signature_mismatch",
    });
  });

  test("a ts more than 5s from now fails with the skew", () => {
    const header = `ts=${TS};h1=${sign(BODY, TS)}`;
    expect(verifyPaddleSignature(BODY, header, SECRET, NOW + 6_000)).toEqual({
      ok: false,
      reason: "timestamp_out_of_range",
      skewSeconds: 6,
    });
    expect(verifyPaddleSignature(BODY, header, SECRET, NOW - 60_000)).toEqual({
      ok: false,
      reason: "timestamp_out_of_range",
      skewSeconds: -60,
    });
  });

  test("a missing or malformed header fails", () => {
    const h1 = sign(BODY, TS);
    expect(verifyPaddleSignature(BODY, null, SECRET, NOW)).toEqual({
      ok: false,
      reason: "missing_header",
    });
    expect(verifyPaddleSignature(BODY, "", SECRET, NOW)).toEqual({
      ok: false,
      reason: "missing_header",
    });
    for (const header of [
      h1,
      `h1=${h1}`,
      `ts=${TS}`,
      `ts=abc;h1=${h1}`,
      `ts=${TS};h1=`,
      `ts=${TS};h1=${h1}=`,
      `ts=-${TS};h1=${h1}`,
    ]) {
      expect(verifyPaddleSignature(BODY, header, SECRET, NOW)).toEqual({
        ok: false,
        reason: "malformed_header",
      });
    }
  });

  test("two h1 values pass when either matches", () => {
    const good = sign(BODY, TS);
    const old = sign(BODY, TS, "rotated_out_secret");
    for (const header of [`ts=${TS};h1=${good};h1=${old}`, `ts=${TS}; h1=${old}; h1=${good}`]) {
      expect(verifyPaddleSignature(BODY, header, SECRET, NOW)).toEqual({ ok: true });
    }
    expect(verifyPaddleSignature(BODY, `ts=${TS};h1=${old};h1=abc`, SECRET, NOW)).toEqual({
      ok: false,
      reason: "signature_mismatch",
    });
  });
});
