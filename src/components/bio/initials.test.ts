import { describe, expect, it } from "bun:test";

import { getInitials } from "./initials";

describe("getInitials", () => {
  it("takes the first and last word's initials", () => {
    expect(getInitials("Ada Lovelace")).toBe("AL");
    expect(getInitials("ada byron lovelace")).toBe("AL");
    expect(getInitials("Kofi")).toBe("K");
  });

  it("skips symbols and handles non-Latin text", () => {
    expect(getInitials("@kofi.mensah")).toBe("K");
    expect(getInitials("  ✨ Studio  Nine ")).toBe("SN");
    expect(getInitials("Élodie Ñúñez")).toBe("ÉÑ");
    expect(getInitials("東京 デザイン")).toBe("東デ");
  });

  it("returns nothing when there is no usable text", () => {
    expect(getInitials(null)).toBe("");
    expect(getInitials("")).toBe("");
    expect(getInitials("✨ 🚀")).toBe("");
  });
});
