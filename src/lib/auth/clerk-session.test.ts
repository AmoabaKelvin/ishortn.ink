import { describe, expect, test } from "bun:test";

import { hasClerkSessionCookie } from "./clerk-session";

describe("hasClerkSessionCookie", () => {
  test("is false without cookies", () => {
    expect(hasClerkSessionCookie("")).toBe(false);
  });

  test("is false when Clerk marks the client signed out", () => {
    expect(hasClerkSessionCookie("__client_uat=0; ish_ft=abc")).toBe(false);
    expect(hasClerkSessionCookie("__client_uat_Xy12-ab=0")).toBe(false);
  });

  test("is true for a signed-in client, suffixed or not", () => {
    expect(hasClerkSessionCookie("ish_ft=abc; __client_uat=1763600000")).toBe(true);
    expect(hasClerkSessionCookie("__client_uat_Xy12-ab=1763600000")).toBe(true);
  });

  test("ignores other cookies with similar names", () => {
    expect(hasClerkSessionCookie("my__client_uat=1763600000; __client_uat_x=")).toBe(false);
  });
});
