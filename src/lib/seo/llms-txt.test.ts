import { describe, expect, it } from "bun:test";

import { FREE_QR_CODE_LIMIT } from "@/lib/billing/entitlements";
import { PLAN_CAPS } from "@/lib/billing/plans";
import { PLAN_PRICES_ANNUAL_USD, PLAN_PRICES_USD } from "@/lib/constants/plan-pricing";

import { buildLlmsTxt } from "./llms-txt";

describe("buildLlmsTxt", () => {
  it("points agents at the MCP server and its setup docs", () => {
    const body = buildLlmsTxt();
    expect(body).toContain("https://ishortn.ink/mcp (streamable HTTP");
    expect(body).toContain("(https://ishortn.ink/docs/integrations/mcp)");
  });

  it("states the current plan prices and limits", () => {
    const body = buildLlmsTxt();
    expect(body.startsWith("# iShortn\n")).toBe(true);
    expect(body).toContain(`$${PLAN_PRICES_USD.pro}`);
    expect(body).toContain(
      `Pro, $${PLAN_PRICES_USD.pro} a month or $${PLAN_PRICES_ANNUAL_USD.pro} a year`,
    );
    expect(body).toContain(`${FREE_QR_CODE_LIMIT} dynamic QR codes`);
    expect(body).toContain(`${PLAN_CAPS.free.linksLimit} links a month`);
    expect(body).toContain("1 link-in-bio page with up to 3 link blocks, 1 campaign.");
  });

  it("follows the billing constants", () => {
    const body = buildLlmsTxt({
      prices: { ...PLAN_PRICES_USD, pro: 12 },
      freeQrCodeLimit: 9,
      caps: { ...PLAN_CAPS, pro: { ...PLAN_CAPS.pro, linksLimit: 2500, domainLimit: 1 } },
    });
    expect(body).toContain("Pro at $12 a month");
    expect(body).toContain("9 dynamic QR codes");
    expect(body).toContain("2,500 links a month");
    expect(body).toContain("1 custom domain,");
    expect(body).not.toContain(`Pro at $${PLAN_PRICES_USD.pro} a month`);
  });

  it("lists only live blog posts under Guides", () => {
    const some = buildLlmsTxt({ isLive: (slug) => slug === "bitly-alternatives" });
    expect(some).toContain("- [Bitly alternatives](https://ishortn.ink/blog/bitly-alternatives)");
    expect(some).not.toContain("/blog/linktree-alternatives");

    expect(buildLlmsTxt({ isLive: () => false })).not.toContain("## Guides");
  });
});
