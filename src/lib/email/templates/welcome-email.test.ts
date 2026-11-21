import { describe, expect, test } from "bun:test";

import { render } from "@react-email/components";
import { createElement } from "react";

import WelcomeEmail, { CREATE_LINK_URL } from "./welcome-email";

const UTM = "utm_source=email&amp;utm_medium=lifecycle&amp;utm_campaign=welcome";

describe("welcome email", () => {
  test("leads with creating the first link", async () => {
    const html = await render(createElement(WelcomeEmail, { userFirstname: "Ada" }));

    expect(html).toContain("Hi <!-- -->Ada<!-- -->,");
    expect(html).toContain("Welcome to iShortn!");
    expect(html).not.toContain("Welcome and signing up");
    expect(html).toContain("Shorten your first link");
    expect(CREATE_LINK_URL).toBe(
      "https://ishortn.ink/dashboard/link/new?utm_source=email&utm_medium=lifecycle&utm_campaign=welcome",
    );
    expect(html).toContain(`href="https://ishortn.ink/dashboard/link/new?${UTM}"`);
  });

  test("links each next step to its docs page", async () => {
    const html = await render(createElement(WelcomeEmail, { userFirstname: "Ada" }));

    for (const slug of ["qr-codes", "custom-domains", "bio-pages"]) {
      expect(html).toContain(`href="https://ishortn.ink/docs/${slug}?${UTM}"`);
    }
    expect(html).toContain("(Pro)");
  });

  test("fixes the footer typo and keeps the rest of it", async () => {
    const html = await render(createElement(WelcomeEmail, { userFirstname: "" }));

    expect(html).toContain("Hi <!-- -->there<!-- -->,");
    expect(html).not.toMatch(/incase/i);
    expect(html).toContain("In case you need an engineer on your team or a freelancer");
    expect(html).toContain('href="https://kelvinamoaba.com"');
  });

  test("plain-text version carries the same copy", async () => {
    const text = await render(createElement(WelcomeEmail, { userFirstname: "Ada" }), {
      plainText: true,
    });

    expect(text).toContain("Welcome to iShortn!");
    expect(text).toContain("Shorten your first link");
    expect(text).toContain("Make a QR code for a link");
  });
});
