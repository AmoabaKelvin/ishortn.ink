import { describe, expect, it } from "bun:test";

import { FREE_QR_CODE_LIMIT } from "@/lib/billing/entitlements";
import { PLAN_PRICES_USD } from "@/lib/constants/plan-pricing";
import { competitors } from "@/lib/seo/competitors";

import { landingPageCopy } from "./landing-page";
import { linkOwnershipFaq } from "./link-ownership";

const faqText = landingPageCopy.faq.map((f) => `${f.question} ${f.answer}`).join("\n");
const answerTo = (question: string) =>
  landingPageCopy.faq.find((f) => f.question === question)?.answer ?? "";

describe("homepage FAQ", () => {
  it("states plan facts from the billing constants", () => {
    expect(faqText).toContain(`${FREE_QR_CODE_LIMIT} dynamic QR codes`);
    expect(faqText).toContain(`$${PLAN_PRICES_USD.pro}`);
    expect(faqText).toContain(`$${PLAN_PRICES_USD.ultra}`);
  });

  // The Bitly answer quotes the comparison data; when Bitly's plans are re-checked, update both.
  it("quotes Bitly figures that match the comparison page", () => {
    const answer = answerTo("Is iShortn a good free alternative to Bitly?");
    const bitlyFreeLinks = competitors.bitly.freeLinks.split("/")[0];
    expect(answer).toContain(`Bitly Free allows ${bitlyFreeLinks} links a month`);
    const growthPrice = competitors.bitly.customDomains.match(/\$\d+/)?.[0];
    expect(growthPrice).toBeDefined();
    expect(answer).toContain(`${growthPrice} a month billed annually on Bitly Growth`);
  });

  it("includes the link ownership answer shared with the pricing FAQ", () => {
    expect(answerTo(linkOwnershipFaq.question)).toBe(linkOwnershipFaq.answer);
  });

  it("makes no overstated safety claims", () => {
    expect(faqText).not.toContain("AI-based");
    expect(faqText).not.toContain("restrict access by geographic region");
  });
});
