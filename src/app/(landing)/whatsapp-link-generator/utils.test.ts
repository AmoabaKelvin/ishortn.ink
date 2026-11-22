import { describe, expect, it } from "bun:test";

import {
  buildWhatsAppLink,
  FEATURES_SIGNUP_HREF,
  featuresSignupHref,
  getShortenHref,
  normalizePhone,
} from "./utils";

const digitsOf = (input: string, dial: string) => {
  const result = normalizePhone(input, dial);
  if (!result.ok) throw new Error(`expected ${input} to be valid, got: ${result.error}`);
  return result.digits;
};

const errorOf = (input: string, dial: string) => {
  const result = normalizePhone(input, dial);
  return result.ok ? null : result.error;
};

describe("normalizePhone", () => {
  it("reads + and 00 as international and ignores the selected country", () => {
    expect(digitsOf("+44 7700 900123", "")).toBe("447700900123");
    expect(digitsOf("+44 7700 900123", "233")).toBe("447700900123");
    expect(digitsOf("0044 7700 900123", "1")).toBe("447700900123");
  });

  it("drops the trunk 0 and adds the selected country code", () => {
    expect(digitsOf("07700 900123", "44")).toBe("447700900123");
    expect(digitsOf("024 412 3456", "233")).toBe("233244123456");
    expect(digitsOf("(555) 123-4567", "1")).toBe("15551234567");
  });

  it("keeps the leading 0 of Italian numbers", () => {
    expect(digitsOf("06 1234 5678", "39")).toBe("390612345678");
  });

  it("drops the trunk 8 of 11-digit Russian numbers", () => {
    expect(digitsOf("8 916 123-45-67", "7")).toBe("79161234567");
  });

  it("doesn't add the country code twice", () => {
    const result = normalizePhone("447700900123", "44");
    expect(result).toEqual({
      ok: true,
      digits: "447700900123",
      display: "+447700900123",
      notes: [{ code: "dial_already_included", dial: "44" }],
    });
  });

  it("hints at the 9 Argentine mobiles need", () => {
    const result = normalizePhone("11 2345 6789", "54");
    expect(result).toEqual({
      ok: true,
      digits: "541123456789",
      display: "+541123456789",
      notes: [{ code: "argentina_mobile" }],
    });
    expect(normalizePhone("9 11 2345 6789", "54")).toMatchObject({ notes: [] });
  });

  it("asks for a country when the number has no international prefix", () => {
    expect(errorOf("7700 900123", "")).toBe("no_country");
  });

  it("rejects numbers that are too short or too long", () => {
    expect(errorOf("12345", "44")).toBe("too_short");
    expect(errorOf(`+${"1".repeat(16)}`, "")).toBe("too_long");
    expect(digitsOf(`+${"1".repeat(15)}`, "")).toBe("1".repeat(15));
  });

  it("rejects anything but digits, separators and a leading +", () => {
    expect(errorOf("+44 7700 9001ab", "")).toBe("invalid_chars");
    expect(errorOf("44+7700900123", "44")).toBe("invalid_chars");
  });

  // 55 is both Brazil's country code and the DDD (area code) of Rio Grande do Sul.
  it("adds 55 to 10- and 11-digit Brazilian numbers, even when the DDD is 55", () => {
    expect(normalizePhone("(55) 99123-4567", "55")).toEqual({
      ok: true,
      digits: "5555991234567",
      display: "+5555991234567",
      notes: [],
    });
    expect(digitsOf("(55) 3222-1234", "55")).toBe("555532221234");
    expect(digitsOf("11 91234-5678", "55")).toBe("5511912345678");
    expect(digitsOf("011 91234-5678", "55")).toBe("5511912345678");
  });

  it("reads 12- and 13-digit Brazilian numbers starting with 55 as international", () => {
    expect(normalizePhone("55 11 91234-5678", "55")).toEqual({
      ok: true,
      digits: "5511912345678",
      display: "+5511912345678",
      notes: [{ code: "dial_already_included", dial: "55" }],
    });
    expect(digitsOf("55 55 99123-4567", "55")).toBe("5555991234567");
    expect(digitsOf("55 11 3222-1234", "55")).toBe("551132221234");
  });

  it("returns an empty result without an error for empty input", () => {
    expect(normalizePhone("", "44")).toEqual({ ok: true, digits: "", display: "", notes: [] });
    expect(normalizePhone("   ", "")).toEqual({ ok: true, digits: "", display: "", notes: [] });
  });
});

describe("buildWhatsAppLink", () => {
  const message = "Hi! 2 pizzas & 1 cola?\nThanks 🙂";
  const encoded = "Hi!%202%20pizzas%20%26%201%20cola%3F%0AThanks%20%F0%9F%99%82";

  it("links to the number alone when there's no message", () => {
    expect(buildWhatsAppLink("447700900123", "")).toBe("https://wa.me/447700900123");
    expect(buildWhatsAppLink("447700900123", "  \n ")).toBe("https://wa.me/447700900123");
  });

  it("encodes the message, line breaks and emoji included", () => {
    expect(buildWhatsAppLink("447700900123", message)).toBe(
      `https://wa.me/447700900123?text=${encoded}`,
    );
    expect(buildWhatsAppLink("447700900123", message.replace("\n", "\r\n"))).toBe(
      `https://wa.me/447700900123?text=${encoded}`,
    );
  });

  it("makes a share link without a number", () => {
    expect(buildWhatsAppLink("", message)).toBe(`https://wa.me/?text=${encoded}`);
  });

  it("returns null with nothing to link to or a link over 2,000 characters", () => {
    expect(buildWhatsAppLink("", "")).toBeNull();
    expect(buildWhatsAppLink("447700900123", "a".repeat(2000))).toBeNull();
  });

  it("round-trips the message through the text parameter", () => {
    const link = buildWhatsAppLink("447700900123", message);
    expect(link).not.toBeNull();
    expect(new URL(link ?? "").searchParams.get("text")).toBe(message);
  });
});

describe("getShortenHref", () => {
  const link = "https://wa.me/447700900123?text=Hi!%20I'd%20like%20to%20place%20an%20order.";

  it("sends signed-out visitors to sign-up with the tool's UTM params only", () => {
    const href = new URL(getShortenHref(link, false), "https://ishortn.ink");
    expect(href.pathname).toBe("/auth/sign-up");
    expect(Object.fromEntries(href.searchParams)).toEqual({
      utm_source: "ishortn",
      utm_medium: "tool",
      utm_campaign: "whatsapp-link",
    });
    expect(getShortenHref(link, null)).toBe(href.pathname + href.search);
  });

  it("tags sign-ups with the page's campaign", () => {
    expect(getShortenHref(null, false, "whatsapp-link-pt")).toContain(
      "utm_campaign=whatsapp-link-pt",
    );
  });

  it("sends signed-in visitors to the link editor with the exact link", () => {
    const href = new URL(getShortenHref(link, true), "https://ishortn.ink");
    expect(href.pathname).toBe("/dashboard/link/new");
    expect(href.searchParams.get("url")).toBe(link);
    expect(getShortenHref(null, true)).toBe("/dashboard/link/new");
  });
});

describe("featuresSignupHref", () => {
  it("keeps the English page's link and tags other pages with their campaign", () => {
    expect(FEATURES_SIGNUP_HREF).toBe(
      "/auth/sign-up?utm_source=ishortn&utm_medium=tool&utm_campaign=whatsapp-link&utm_content=features",
    );
    expect(featuresSignupHref("whatsapp-link-pt")).toBe(
      "/auth/sign-up?utm_source=ishortn&utm_medium=tool&utm_campaign=whatsapp-link-pt&utm_content=features",
    );
  });
});
