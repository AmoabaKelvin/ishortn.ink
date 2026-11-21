import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import path from "node:path";

import { render } from "@react-email/components";
import { createElement, type FunctionComponent } from "react";

import FirstLinkNudgeEmail from "./first-link-nudge";

type Template = FunctionComponent<object> & { PreviewProps?: object };

const files = readdirSync(import.meta.dir).filter(
  (file) => file.endsWith(".tsx") && !file.endsWith(".test.tsx"),
);

describe("email templates", () => {
  test("every template is covered", () => {
    expect(files.length).toBe(16);
  });

  for (const file of files) {
    test(`${file} renders in the shared layout`, async () => {
      const mod: { default: Template } = await import(path.join(import.meta.dir, file));
      const Template = mod.default;
      expect(Template.PreviewProps).toBeDefined();

      const html = await render(createElement(Template, Template.PreviewProps));

      // Logo and footer from EmailLayout
      expect(html).toContain(">iShortn</a>");
      expect(html).toContain("mailto:support@ishortn.ink");
      expect(html).toContain("https://ishortn.ink/dashboard");
      // No fixed widths that could overflow a 390px screen
      expect(html).not.toMatch(/(?<![-\w])width:\s*\d{3,}px/);
    });
  }
});

describe("first link nudge", () => {
  test("links to link and QR creation and offers a way to turn it off", async () => {
    const html = await render(createElement(FirstLinkNudgeEmail, FirstLinkNudgeEmail.PreviewProps));

    expect(html).toContain("Create your first link");
    expect(html).toContain(
      "https://ishortn.ink/dashboard/link/new?utm_source=email&amp;utm_medium=lifecycle&amp;utm_campaign=first_link_nudge",
    );
    expect(html).toContain("Prefer a QR code?");
    expect(html).toContain("https://ishortn.ink/dashboard/qrcodes/create?utm_source=email");
    expect(html).toContain("The iShortn team");
    expect(html).toContain("Manage notifications");
  });
});
