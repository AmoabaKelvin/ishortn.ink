import { describe, expect, test } from "bun:test";

import { normalizeSocialUrl } from "./social-links";

describe("normalizeSocialUrl", () => {
  test("builds profile URLs from bare handles", () => {
    expect(normalizeSocialUrl("twitter", "jack")).toBe("https://x.com/jack");
    expect(normalizeSocialUrl("instagram", "jane")).toBe("https://instagram.com/jane");
    expect(normalizeSocialUrl("github", "octocat")).toBe("https://github.com/octocat");
    expect(normalizeSocialUrl("tiktok", "charli")).toBe("https://tiktok.com/@charli");
    expect(normalizeSocialUrl("linkedin", "jane-doe")).toBe("https://linkedin.com/in/jane-doe");
  });

  test("strips a leading @ from handles", () => {
    expect(normalizeSocialUrl("twitter", "@jack")).toBe("https://x.com/jack");
    expect(normalizeSocialUrl("threads", "@jane")).toBe("https://threads.net/@jane");
  });

  test("keeps handles that legitimately contain dots", () => {
    expect(normalizeSocialUrl("instagram", "john.doe")).toBe("https://instagram.com/john.doe");
  });

  test("turns an email into a mailto link", () => {
    expect(normalizeSocialUrl("email", "me@example.com")).toBe("mailto:me@example.com");
  });

  test("rejects a non-email for the email platform", () => {
    expect(normalizeSocialUrl("email", "not-an-email")).toBeNull();
  });

  test("reduces whatsapp input to digits", () => {
    expect(normalizeSocialUrl("whatsapp", "+1 (555) 123-4567")).toBe("https://wa.me/15551234567");
  });

  test("keeps full URLs as written", () => {
    expect(normalizeSocialUrl("twitter", "https://x.com/jack")).toBe("https://x.com/jack");
    expect(normalizeSocialUrl("email", "mailto:me@example.com")).toBe("mailto:me@example.com");
  });

  test("adds a scheme to a pasted host or bare domain", () => {
    expect(normalizeSocialUrl("instagram", "instagram.com/jane")).toBe("https://instagram.com/jane");
    expect(normalizeSocialUrl("website", "example.com")).toBe("https://example.com");
  });

  test("returns null for empty input", () => {
    expect(normalizeSocialUrl("twitter", "   ")).toBeNull();
  });

  test("rejects unsafe schemes", () => {
    expect(normalizeSocialUrl("website", "javascript:alert(1)")).toBeNull();
  });
});
