import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import path from "node:path";

import { render } from "@react-email/components";
import { createElement, type FunctionComponent } from "react";

type Template = FunctionComponent<object> & { PreviewProps?: object };

const files = readdirSync(import.meta.dir).filter(
  (file) => file.endsWith(".tsx") && !file.endsWith(".test.tsx"),
);

describe("email templates", () => {
  test("every template is covered", () => {
    expect(files.length).toBe(14);
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
