import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { CHROME_WEB_STORE_SITE_URL, CHROME_WEB_STORE_URL } from "./extension";

describe("Chrome Web Store links", () => {
  it("tags the site link for the store's install reports", () => {
    const url = new URL(CHROME_WEB_STORE_SITE_URL);
    expect(`${url.origin}${url.pathname}`).toBe(CHROME_WEB_STORE_URL);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      utm_source: "ishortn",
      utm_medium: "site",
      utm_campaign: "extension",
    });
  });

  // MDX can't import the constant, so the docs copy is checked against it instead.
  it("uses the same store link in the extension docs", () => {
    const docs = readFileSync(
      join(process.cwd(), "content/docs/integrations/browser-extension.mdx"),
      "utf8",
    );
    expect(docs).toContain(`(${CHROME_WEB_STORE_SITE_URL})`);
  });
});
