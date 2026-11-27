import { describe, expect, test } from "bun:test";

import {
  defaultConsentText,
  parseEmailCapture,
  serializeEmailCapture,
  subscriberEmailSchema,
} from "./email-capture";

describe("email signup settings", () => {
  test("round-trip through the stored JSON", () => {
    const settings = {
      buttonLabel: "Join",
      successMessage: "You're in!",
      consentText: defaultConsentText("Ana's Bakery"),
    };
    expect(parseEmailCapture(serializeEmailCapture(settings))).toEqual(settings);
    expect(settings.consentText).toBe("I agree to receive emails from Ana's Bakery.");
  });

  test("missing or foreign content falls back to defaults", () => {
    const empty = { buttonLabel: "", successMessage: "", consentText: "" };
    expect(parseEmailCapture(null)).toEqual(empty);
    expect(parseEmailCapture("not json")).toEqual(empty);
    expect(parseEmailCapture(JSON.stringify({ kind: "embed", provider: "youtube" }))).toEqual(
      empty,
    );
  });
});

describe("subscriberEmailSchema", () => {
  test("trims and lowercases a valid address", () => {
    expect(subscriberEmailSchema.parse("  Ana@Example.COM ")).toBe("ana@example.com");
  });

  test("rejects invalid and overlong addresses", () => {
    expect(subscriberEmailSchema.safeParse("ana@").success).toBe(false);
    expect(subscriberEmailSchema.safeParse("").success).toBe(false);
    expect(subscriberEmailSchema.safeParse(`${"a".repeat(250)}@x.com`).success).toBe(false);
  });
});
