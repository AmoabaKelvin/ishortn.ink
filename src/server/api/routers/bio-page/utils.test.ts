import { describe, expect, test } from "bun:test";

import { assertBioLinkBlockCapacity, assertSlugAllowed, RESERVED_BIO_SLUGS } from "./utils";

describe("reserved bio slugs", () => {
  test("excludes the /p route prefix and core app routes", () => {
    for (const slug of ["p", "api", "trpc", "dashboard", "auth", "admin", "abuse"]) {
      expect(RESERVED_BIO_SLUGS.has(slug)).toBe(true);
    }
  });

  test("assertSlugAllowed rejects reserved handles (case-insensitively)", () => {
    expect(() => assertSlugAllowed("dashboard")).toThrow();
    expect(() => assertSlugAllowed("API")).toThrow();
    expect(() => assertSlugAllowed("Admin")).toThrow();
  });

  test("assertSlugAllowed accepts normal handles", () => {
    expect(() => assertSlugAllowed("janedoe")).not.toThrow();
    expect(() => assertSlugAllowed("my-links")).not.toThrow();
    expect(() => assertSlugAllowed("acme_co")).not.toThrow();
  });
});

describe("bio link block cap", () => {
  test("free pages accept link blocks below the cap", () => {
    expect(() => assertBioLinkBlockCapacity("free", 0)).not.toThrow();
    expect(() => assertBioLinkBlockCapacity("free", 2)).not.toThrow();
  });

  test("free pages reject a 4th link block with an upgrade message", () => {
    expect(() => assertBioLinkBlockCapacity("free", 3)).toThrow(/3 link blocks per bio page/);
    expect(() => assertBioLinkBlockCapacity("free", 10)).toThrow(/Upgrade to Pro/);
  });

  test("paid plans have no link block cap", () => {
    expect(() => assertBioLinkBlockCapacity("pro", 500)).not.toThrow();
    expect(() => assertBioLinkBlockCapacity("ultra", 500)).not.toThrow();
  });
});
