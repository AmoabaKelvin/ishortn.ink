import { describe, expect, test } from "bun:test";

import {
  buildWhatsAppUrl,
  parseWhatsApp,
  serializeWhatsApp,
  whatsappDetailsSchema,
  whatsappPhoneSchema,
} from "./whatsapp";

describe("whatsappPhoneSchema", () => {
  test("accepts E.164 numbers", () => {
    expect(whatsappPhoneSchema.parse("+233241234567")).toBe("+233241234567");
    expect(whatsappPhoneSchema.parse("+14155552671")).toBe("+14155552671");
  });

  test("drops the separators people type", () => {
    expect(whatsappPhoneSchema.parse(" +1 (415) 555-2671 ")).toBe("+14155552671");
    expect(whatsappPhoneSchema.parse("+44 20.7946.0958")).toBe("+442079460958");
  });

  test("rejects numbers without a country code", () => {
    expect(whatsappPhoneSchema.safeParse("0241234567").success).toBe(false);
    expect(whatsappPhoneSchema.safeParse("233241234567").success).toBe(false);
  });

  test("rejects a country code starting with 0", () => {
    expect(whatsappPhoneSchema.safeParse("+0241234567").success).toBe(false);
  });

  test("rejects numbers that are too long or too short", () => {
    expect(whatsappPhoneSchema.safeParse("+1234567890123456").success).toBe(false);
    expect(whatsappPhoneSchema.safeParse("+12345").success).toBe(false);
  });

  test("rejects letters and other characters", () => {
    expect(whatsappPhoneSchema.safeParse("+233abc1234567").success).toBe(false);
    expect(whatsappPhoneSchema.safeParse("+233/241234567").success).toBe(false);
    expect(whatsappPhoneSchema.safeParse("").success).toBe(false);
  });
});

describe("whatsappDetailsSchema", () => {
  test("defaults the message to empty and trims it", () => {
    expect(whatsappDetailsSchema.parse({ phone: "+233241234567" })).toEqual({
      phone: "+233241234567",
      message: "",
    });
    expect(whatsappDetailsSchema.parse({ phone: "+233241234567", message: "  Hi " }).message).toBe(
      "Hi",
    );
  });

  test("caps the message length", () => {
    const message = "a".repeat(501);
    expect(whatsappDetailsSchema.safeParse({ phone: "+233241234567", message }).success).toBe(
      false,
    );
  });
});

describe("buildWhatsAppUrl", () => {
  test("links to wa.me with the digits only", () => {
    expect(buildWhatsAppUrl({ phone: "+233241234567", message: "" })).toBe(
      "https://wa.me/233241234567",
    );
  });

  test("encodes the prefilled message", () => {
    expect(
      buildWhatsAppUrl({ phone: "+14155552671", message: "Hi! I'd like 2 × cake & tea?" }),
    ).toBe("https://wa.me/14155552671?text=Hi!%20I'd%20like%202%20%C3%97%20cake%20%26%20tea%3F");
  });
});

describe("parseWhatsApp", () => {
  test("round-trips serialized details", () => {
    const details = { phone: "+233241234567", message: "Hello" };
    expect(parseWhatsApp(serializeWhatsApp(details))).toEqual(details);
  });

  test("returns null for ordinary link blocks", () => {
    expect(parseWhatsApp(null)).toBeNull();
    expect(parseWhatsApp("")).toBeNull();
    expect(parseWhatsApp("just some text")).toBeNull();
    expect(parseWhatsApp(JSON.stringify({ phone: "+233241234567", message: "" }))).toBeNull();
  });
});
