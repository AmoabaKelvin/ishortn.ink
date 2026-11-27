import { describe, expect, test } from "bun:test";

import { createElement } from "react";

import WelcomeEmail from "@/emails/welcome";

import { cleanPlainText, renderEmail } from "./render-email";

describe("cleanPlainText", () => {
  test("strips the preview padding and the blank lines it leaves", () => {
    const spacer = "\u00A0\u200C\u200B\u200D\u200E\u200F\uFEFF".repeat(4);
    expect(cleanPlainText(`Your weekly summary\n${spacer}\n  \n\n\n\nHi Ama,`)).toBe(
      "Your weekly summary\n\nHi Ama,",
    );
  });

  test("keeps a single non-breaking space in copy", () => {
    expect(cleanPlainText("10\u00A0clicks")).toBe("10\u00A0clicks");
  });

  test("keeps the zero-width joiner inside an emoji sequence", () => {
    const family = "\u{1F468}\u200D\u{1F469}\u200D\u{1F467} Family";
    expect(cleanPlainText(`Team ${family}`)).toBe(`Team ${family}`);
  });

  test("prints a repeated URL once, at its last occurrence", () => {
    const url = "https://ishortn.ink/dashboard/pricing";
    expect(
      cleanPlainText(`Upgrade to Pro ${url}\n\nOr copy and paste this URL:\n${url}\n\nThanks.`),
    ).toBe(`Upgrade to Pro\n\nOr copy and paste this URL:\n${url}\n\nThanks.`);
  });

  test("treats a URL and a longer URL that starts with it as different", () => {
    const text =
      "Dashboard https://ishortn.ink/dashboard\nPricing https://ishortn.ink/dashboard/pricing";
    expect(cleanPlainText(text)).toBe(text);
  });
});

describe("renderEmail", () => {
  test("renders both parts with the recipient in the footer", async () => {
    const { html, text } = await renderEmail(
      createElement(WelcomeEmail, { userName: "Ada Lovelace", founderName: "Kelvin" }),
      "ada@example.com",
    );

    expect(html).toContain("Sent to <!-- -->ada@example.com<!-- -->.");
    expect(text).toStartWith(
      "Paste a long URL, get a short link and a QR code. Here is where to start.\n\nHi Ada,",
    );
    expect(text).toContain("Sent to ada@example.com.");
    // The logo row is left out of the plain text.
    expect(text).not.toContain("https://ishortn.ink/dashboard\n");
    expect(html).not.toContain("{{recipient}}");
  });

  test("escapes the recipient's address in the HTML part", async () => {
    const { html, text } = await renderEmail(
      createElement(WelcomeEmail, { userName: "Ada", founderName: "Kelvin" }),
      "a&b<x>@example.com",
    );

    expect(html).toContain("a&amp;b&lt;x&gt;@example.com");
    expect(html).not.toContain("a&b<x>");
    expect(text).toContain("Sent to a&b<x>@example.com.");
  });
});
