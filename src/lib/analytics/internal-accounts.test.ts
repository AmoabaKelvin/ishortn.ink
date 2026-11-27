import { describe, expect, test } from "bun:test";

import { isInternalEmail } from "./internal-accounts";

describe("isInternalEmail", () => {
  test("matches the internal domains in any case", () => {
    expect(isInternalEmail("qa@euploading.com")).toBe(true);
    expect(isInternalEmail("QA+limits@EUploading.com")).toBe(true);
    expect(isInternalEmail("bot@mail.ishortn.ink")).toBe(true);
  });

  test("leaves everyone else, lookalikes and missing emails as external", () => {
    expect(isInternalEmail("ada@example.com")).toBe(false);
    expect(isInternalEmail("ada@ishortn.ink")).toBe(false);
    expect(isInternalEmail("ada@noteuploading.com")).toBe(false);
    expect(isInternalEmail("euploading.com@example.com")).toBe(false);
    expect(isInternalEmail("euploading.com")).toBe(false);
    expect(isInternalEmail(null)).toBe(false);
    expect(isInternalEmail(undefined)).toBe(false);
  });
});
