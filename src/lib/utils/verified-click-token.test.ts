import { afterEach, beforeEach, describe, expect, mock, setSystemTime, test } from "bun:test";

/** The subset of `@/env.mjs` the module reads; mutable so tests can unset the secret. */
type MockEnv = { VERIFIED_CLICKS_SECRET?: string };

const env: MockEnv = {};
mock.module("@/env.mjs", () => ({ env }));

const { buildBeaconScript, hashDestination, signVerifiedClickToken, verifyVerifiedClickToken } =
  await import("./verified-click-token");

const SECRET = "test-secret-that-is-at-least-32-characters-long";
const VISIT_ID = "3f1c2a8e-4b5d-4e6f-9a0b-1c2d3e4f5a6b";
const DESTINATION = "https://example.com/landing?ref=abc";
const NOW = new Date("2026-01-01T00:00:00.000Z");

function sign(): string {
  const token = signVerifiedClickToken(VISIT_ID, DESTINATION);
  if (!token) throw new Error("expected a token");
  return token;
}

/** Replace one dot-separated segment of the token. */
function withPart(token: string, index: number, value: string): string {
  const parts = token.split(".");
  parts[index] = value;
  return parts.join(".");
}

/** Flip the first character of a segment to a different base64url character. */
function mutate(value: string): string {
  return (value[0] === "A" ? "B" : "A") + value.slice(1);
}

beforeEach(() => {
  env.VERIFIED_CLICKS_SECRET = SECRET;
  setSystemTime(NOW);
});

afterEach(() => {
  setSystemTime();
});

describe("signVerifiedClickToken / verifyVerifiedClickToken", () => {
  test("round-trips the visit ID and destination hash", () => {
    const token = sign();
    expect(token.split(".")).toHaveLength(5);
    expect(verifyVerifiedClickToken(token)).toEqual({
      visitId: VISIT_ID,
      destHash: hashDestination(DESTINATION),
    });
  });

  test("rejects a token signed with a different secret", () => {
    const token = sign();
    env.VERIFIED_CLICKS_SECRET = "another-secret-that-is-at-least-32-characters";
    expect(verifyVerifiedClickToken(token)).toBeNull();
  });

  test.each([
    ["version", 0, "v1"],
    ["visit ID", 1, "00000000-0000-0000-0000-000000000000"],
    ["destination hash", 2, hashDestination("https://evil.example/")],
    ["timestamp", 3, String(NOW.getTime() - 1)],
  ])("rejects a tampered %s", (_name, index, value) => {
    expect(verifyVerifiedClickToken(withPart(sign(), index, value))).toBeNull();
  });

  test("rejects a tampered signature", () => {
    const token = sign();
    const sig = token.split(".")[4] ?? "";
    expect(verifyVerifiedClickToken(withPart(token, 4, mutate(sig)))).toBeNull();
    expect(verifyVerifiedClickToken(withPart(token, 4, sig.slice(0, -2)))).toBeNull();
    expect(verifyVerifiedClickToken(withPart(token, 4, ""))).toBeNull();
  });

  test("rejects malformed tokens", () => {
    const token = sign();
    expect(verifyVerifiedClickToken("")).toBeNull();
    expect(verifyVerifiedClickToken(`${token}.extra`)).toBeNull();
    expect(verifyVerifiedClickToken(token.split(".").slice(0, 4).join("."))).toBeNull();
    expect(verifyVerifiedClickToken(withPart(token, 3, "not-a-number"))).toBeNull();
  });

  test("accepts a token right up to the 5-minute TTL", () => {
    const token = sign();
    setSystemTime(new Date(NOW.getTime() + 5 * 60 * 1000));
    expect(verifyVerifiedClickToken(token)).not.toBeNull();
  });

  test("rejects an expired token", () => {
    const token = sign();
    setSystemTime(new Date(NOW.getTime() + 5 * 60 * 1000 + 1));
    expect(verifyVerifiedClickToken(token)).toBeNull();
  });

  test("tolerates small clock skew but rejects tokens issued too far in the future", () => {
    const token = sign();
    setSystemTime(new Date(NOW.getTime() - 5_000));
    expect(verifyVerifiedClickToken(token)).not.toBeNull();
    setSystemTime(new Date(NOW.getTime() - 5_001));
    expect(verifyVerifiedClickToken(token)).toBeNull();
  });

  test("returns null when VERIFIED_CLICKS_SECRET is unset", () => {
    const token = sign();
    env.VERIFIED_CLICKS_SECRET = undefined;
    expect(signVerifiedClickToken(VISIT_ID, DESTINATION)).toBeNull();
    expect(verifyVerifiedClickToken(token)).toBeNull();
  });
});

describe("hashDestination", () => {
  test("is stable and URL-safe", () => {
    const hash = hashDestination(DESTINATION);
    expect(hashDestination(DESTINATION)).toBe(hash);
    expect(hash).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  test("canonicalizes equivalent URLs to the same hash", () => {
    expect(hashDestination("HTTPS://Example.COM:443")).toBe(
      hashDestination("https://example.com/"),
    );
  });

  test("differs for different destinations", () => {
    expect(hashDestination("https://example.com/a")).not.toBe(
      hashDestination("https://example.com/b"),
    );
  });

  test("falls back to the raw string for unparseable input", () => {
    expect(hashDestination("not a url")).toBe(hashDestination("not a url"));
    expect(hashDestination("not a url")).not.toBe(hashDestination("not  a url"));
  });
});

describe("buildBeaconScript", () => {
  test("embeds the token as a JSON string literal", () => {
    const token = sign();
    const script = buildBeaconScript(token);
    expect(script).toContain(`{token:${JSON.stringify(token)}}`);
    expect(script).toContain("'/api/v1/clicks/verify'");
  });

  test("escapes characters that could break out of an inline script", () => {
    const script = buildBeaconScript("</script><script>alert(1)</script>&\u2028\u2029'\"");
    expect(script).not.toContain("</script>");
    expect(script).not.toMatch(/[<>&\u2028\u2029]/);
    expect(script).toContain(
      '{token:"\\u003C/script\\u003E\\u003Cscript\\u003Ealert(1)\\u003C/script\\u003E\\u0026\\u2028\\u2029\'\\""}',
    );
  });
});
