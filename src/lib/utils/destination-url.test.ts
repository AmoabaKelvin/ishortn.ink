import { describe, expect, test } from "bun:test";

import {
  destinationUrlSchema,
  INVALID_URL_MESSAGE,
  normalizeDestinationUrl,
} from "./destination-url";

describe("normalizeDestinationUrl", () => {
  test("adds https:// when the scheme is missing", () => {
    expect(normalizeDestinationUrl("example.org")).toBe("https://example.org");
    expect(normalizeDestinationUrl("www.example.org")).toBe("https://www.example.org");
    expect(normalizeDestinationUrl("EXAMPLE.org/path")).toBe("https://EXAMPLE.org/path");
    expect(normalizeDestinationUrl("example.org:8080/a?b=c#d")).toBe(
      "https://example.org:8080/a?b=c#d",
    );
    expect(normalizeDestinationUrl("//example.org/x")).toBe("https://example.org/x");
  });

  test("trims surrounding whitespace", () => {
    expect(normalizeDestinationUrl("  example.org \n")).toBe("https://example.org");
    expect(normalizeDestinationUrl(" https://example.org ")).toBe("https://example.org");
  });

  test("keeps URLs that already have a scheme", () => {
    expect(normalizeDestinationUrl("https://example.org")).toBe("https://example.org");
    expect(normalizeDestinationUrl("http://example.org/a")).toBe("http://example.org/a");
    expect(normalizeDestinationUrl("HTTPS://Example.org")).toBe("HTTPS://Example.org");
    expect(normalizeDestinationUrl("http://localhost:3000")).toBe("http://localhost:3000");
    expect(normalizeDestinationUrl("ftp://files.example.org")).toBe("ftp://files.example.org");
  });

  test("keeps schemes without //, such as mailto, tel and sms", () => {
    expect(normalizeDestinationUrl("mailto:hi@example.com")).toBe("mailto:hi@example.com");
    expect(normalizeDestinationUrl("tel:+15551234")).toBe("tel:+15551234");
    expect(normalizeDestinationUrl("tel:5551234")).toBe("tel:5551234");
    expect(normalizeDestinationUrl("sms:+15551234?body=hi")).toBe("sms:+15551234?body=hi");
  });

  test("reads host:port as a host, not a scheme", () => {
    expect(normalizeDestinationUrl("example.org:8080")).toBe("https://example.org:8080");
    expect(normalizeDestinationUrl("www.example.org:443?x=1")).toBe(
      "https://www.example.org:443?x=1",
    );
    expect(normalizeDestinationUrl("localhost:3000")).toBeNull();
  });

  test("rejects input that is not a URL", () => {
    expect(normalizeDestinationUrl("")).toBeNull();
    expect(normalizeDestinationUrl("   ")).toBeNull();
    expect(normalizeDestinationUrl("hello")).toBeNull();
    expect(normalizeDestinationUrl("not a url")).toBeNull();
    expect(normalizeDestinationUrl("exa mple.org")).toBeNull();
    expect(normalizeDestinationUrl("https://")).toBeNull();
    expect(normalizeDestinationUrl("http://exa mple.org")).toBeNull();
  });
});

describe("destinationUrlSchema", () => {
  test("outputs the normalised URL", () => {
    expect(destinationUrlSchema.parse("example.org")).toBe("https://example.org");
  });

  test("fails with the validation message", () => {
    const result = destinationUrlSchema.safeParse("not a url");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(INVALID_URL_MESSAGE);
  });
});
