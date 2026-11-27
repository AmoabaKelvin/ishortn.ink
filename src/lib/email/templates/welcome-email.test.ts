import { describe, expect, test } from "bun:test";

import { render } from "@react-email/components";
import { createElement } from "react";

import WelcomeEmail, { CREATE_LINK_URL } from "./welcome-email";

describe("welcome email", () => {
  test("leads with creating the first link", async () => {
    const html = await render(createElement(WelcomeEmail, { userName: "Ada Lovelace" }));

    expect(html).toContain("Hi <!-- -->Ada<!-- -->,");
    expect(html).toContain("Welcome to iShortn!");
    expect(html).not.toContain("Welcome and signing up");
    expect(html).toContain("Shorten your first link");
    expect(CREATE_LINK_URL).toBe("https://ishortn.ink/e-welcome-link");
    expect(html).toContain(`href="${CREATE_LINK_URL}"`);
  });

  test("links each next step to its docs page", async () => {
    const html = await render(createElement(WelcomeEmail, { userName: "Ada Lovelace" }));

    for (const alias of ["e-welcome-qr", "e-welcome-domains", "e-welcome-bio"]) {
      expect(html).toContain(`href="https://ishortn.ink/${alias}"`);
    }
    expect(html).toContain("(Pro)");
  });

  test("fixes the footer typo and keeps the rest of it", async () => {
    const html = await render(createElement(WelcomeEmail, { userName: "" }));

    expect(html).toContain("Hi <!-- -->there<!-- -->,");
    expect(html).not.toMatch(/incase/i);
    expect(html).toContain("In case you need an engineer on your team or a freelancer");
    expect(html).toContain('href="https://kelvinamoaba.com"');
  });

  test("greets users without a real name as there", async () => {
    for (const userName of [null, "null null", "null"]) {
      const html = await render(createElement(WelcomeEmail, { userName }));

      expect(html).toContain("Hi <!-- -->there<!-- -->,");
      expect(html).not.toContain("null");
    }
  });

  test("plain-text version carries the same copy", async () => {
    const text = await render(createElement(WelcomeEmail, { userName: "Ada Lovelace" }), {
      plainText: true,
    });

    expect(text).toContain("Welcome to iShortn!");
    expect(text).toContain("Shorten your first link");
    expect(text).toContain("Make a QR code for a link");
  });
});
