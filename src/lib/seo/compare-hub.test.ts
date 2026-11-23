import { describe, expect, it } from "bun:test";

import { FREE_QR_CODE_LIMIT } from "@/lib/billing/entitlements";
import { PLAN_CAPS } from "@/lib/billing/plans";
import { PLAN_PRICES_USD } from "@/lib/constants/plan-pricing";

import {
  compareFaqs,
  compareIntro,
  compareTables,
  formatCheckedOn,
  ishortnRows,
} from "./compare-hub";
import { competitors } from "./competitors";

const billing = { caps: PLAN_CAPS, prices: PLAN_PRICES_USD, freeQrCodes: FREE_QR_CODE_LIMIT };

describe("compare hub", () => {
  it("builds iShortn's cells from the billing constants", () => {
    const { shortener, linkInBio } = ishortnRows(billing);
    expect(shortener.freeLinks).toBe("30/month");
    expect(shortener.pricing).toBe("Pro $8/mo, Ultra $15/mo");
    expect(shortener.customDomains).toBe("3 on Pro ($8/mo), unlimited on Ultra");
    expect(shortener.qrCodes).toBe("5 dynamic on Free, never expire");
    expect(shortener.freeAnalytics).toBe("7 days on Free, unlimited history on Pro");
    expect(linkInBio.freeLinks).toBe("1 on Free (3 link blocks), 3 on Pro, unlimited on Ultra");
    expect(linkInBio.customDomains).toBe("Bio pages on your own domain from Pro ($8/mo)");
    expect(compareIntro(billing)).toContain("5 dynamic QR codes");
    expect(compareIntro(billing)).toContain("Pro is $8 a month");
  });

  it("follows a plan change instead of keeping stale copy", () => {
    const caps = { ...PLAN_CAPS, free: { ...PLAN_CAPS.free, linksLimit: 50 } };
    const prices = { ...PLAN_PRICES_USD, pro: 9 };
    const changed = { caps, prices, freeQrCodes: 10 };
    expect(ishortnRows(changed).shortener.freeLinks).toBe("50/month");
    expect(ishortnRows(changed).shortener.pricing).toStartWith("Pro $9/mo");
    expect(compareIntro(changed)).toContain("50 links a month");
    expect(compareFaqs(changed)[3]?.answer).toContain("includes 10 dynamic QR codes");
  });

  it("puts iShortn first and every competitor in exactly one table", () => {
    const tables = compareTables(billing);
    expect(tables).toHaveLength(2);
    for (const table of tables) expect(table.rows[0]?.name).toBe("iShortn");
    const competitorRows = tables.flatMap((table) => table.rows.slice(1));
    const list = Object.values(competitors);
    expect(competitorRows.map((row) => row.href).sort()).toEqual(
      list.map((c) => `/compare/${c.slug}`).sort(),
    );
    const bitly = competitorRows.find((row) => row.name === competitors.bitly.name);
    expect(bitly?.pricing).toBe(competitors.bitly.pricing);
    expect(bitly?.checkedOn).toBe(competitors.bitly.pricesCheckedOn);
  });

  it("has five FAQs", () => {
    expect(compareFaqs(billing)).toHaveLength(5);
  });

  it("formats the checked date without timezone drift", () => {
    expect(formatCheckedOn("2026-11-22")).toBe("22 Nov 2026");
    expect(formatCheckedOn("2026-01-01")).toBe("1 Jan 2026");
  });
});
