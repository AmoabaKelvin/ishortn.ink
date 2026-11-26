import { describe, expect, it } from "bun:test";

import { resolveRobots } from "next/dist/build/webpack/loaders/metadata/resolve-route-data";

// test/setup.ts sets NEXT_PUBLIC_APP_URL before env.mjs loads.
import robots from "./robots";

describe("robots", () => {
  it("renders the content signal inside the User-Agent: * group with every existing rule", () => {
    expect(resolveRobots(robots())).toBe(
      [
        "User-Agent: *",
        "Allow: /",
        "Disallow: /dashboard",
        "Disallow: /auth",
        "Disallow: /verify-password",
        "Disallow: /blocked",
        "Disallow: /cloaked",
        "Disallow: /api",
        "Disallow: /account",
        "Disallow: /teams/accept-invite",
        "Disallow: /docs-site",
        "Content-Signal: search=yes, ai-input=yes, ai-train=yes",
        "",
        "Sitemap: https://ishortn.ink/sitemap.xml",
        "",
      ].join("\n"),
    );
  });
});
