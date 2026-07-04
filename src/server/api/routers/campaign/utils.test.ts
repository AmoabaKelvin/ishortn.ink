import { describe, expect, test } from "bun:test";

import {
  getCampaignDisplayState,
  mergeCampaignUtm,
  normalizeCampaignSlug,
  normalizeUtmValue,
} from "./utils";

describe("normalizeCampaignSlug", () => {
  test("lowercases, trims, and hyphenates whitespace", () => {
    expect(normalizeCampaignSlug("Summer Launch 2026")).toBe("summer-launch-2026");
    expect(normalizeCampaignSlug("  Black Friday  ")).toBe("black-friday");
  });

  test("converts underscores and collapses repeats", () => {
    expect(normalizeCampaignSlug("email_blast__july")).toBe("email-blast-july");
    expect(normalizeCampaignSlug("a - - b")).toBe("a-b");
  });

  test("strips invalid characters and edge hyphens", () => {
    expect(normalizeCampaignSlug("Q3: Launch! (Paid)")).toBe("q3-launch-paid");
    expect(normalizeCampaignSlug("---promo---")).toBe("promo");
  });

  test("returns empty string when nothing survives", () => {
    expect(normalizeCampaignSlug("!!!")).toBe("");
    expect(normalizeCampaignSlug("   ")).toBe("");
  });

  test("bounds length to 100", () => {
    expect(normalizeCampaignSlug("x".repeat(150)).length).toBe(100);
  });

  test("truncation never leaves a trailing hyphen", () => {
    const slug = normalizeCampaignSlug(`${"a".repeat(99)}-b`);
    expect(slug.endsWith("-")).toBe(false);
    expect(slug).toBe("a".repeat(99));
  });
});

describe("normalizeUtmValue", () => {
  test("lowercases and hyphenates", () => {
    expect(normalizeUtmValue("Paid Social")).toBe("paid-social");
    expect(normalizeUtmValue("  Email ")).toBe("email");
  });

  test("maps empty/null to null", () => {
    expect(normalizeUtmValue("")).toBeNull();
    expect(normalizeUtmValue("   ")).toBeNull();
    expect(normalizeUtmValue(null)).toBeNull();
    expect(normalizeUtmValue(undefined)).toBeNull();
  });
});

describe("mergeCampaignUtm", () => {
  const campaignRow = {
    slug: "summer-launch",
    utmSource: "newsletter",
    utmMedium: "email",
    utmTerm: null,
    utmContent: null,
  };

  test("stamps slug as utm_campaign and fills defaults", () => {
    expect(mergeCampaignUtm(campaignRow, undefined)).toEqual({
      utm_campaign: "summer-launch",
      utm_source: "newsletter",
      utm_medium: "email",
    });
  });

  test("explicit link values win over campaign defaults", () => {
    expect(
      mergeCampaignUtm(campaignRow, { utm_source: "instagram", utm_term: "bio" }),
    ).toEqual({
      utm_campaign: "summer-launch",
      utm_source: "instagram",
      utm_medium: "email",
      utm_term: "bio",
    });
  });

  test("utm_campaign always comes from the slug, even if the link carries a stale one", () => {
    expect(
      mergeCampaignUtm(campaignRow, { utm_campaign: "old-campaign", utm_source: "instagram" }),
    ).toEqual({
      utm_campaign: "summer-launch",
      utm_source: "instagram",
      utm_medium: "email",
    });
  });

  test("empty-string link values do not override defaults", () => {
    expect(mergeCampaignUtm(campaignRow, { utm_source: "" })?.utm_source).toBe("newsletter");
  });

  test("returns undefined when there is nothing to stamp", () => {
    expect(
      mergeCampaignUtm(
        { slug: "", utmSource: null, utmMedium: null, utmTerm: null, utmContent: null },
        undefined,
      ),
    ).toBeUndefined();
  });
});

describe("getCampaignDisplayState", () => {
  const now = new Date("2026-07-03T12:00:00Z");

  test("archived always wins", () => {
    expect(
      getCampaignDisplayState(
        { status: "archived", startDate: null, endDate: new Date("2026-01-01") },
        now,
      ),
    ).toBe("archived");
  });

  test("future startDate reads as scheduled", () => {
    expect(
      getCampaignDisplayState(
        { status: "active", startDate: new Date("2026-08-01"), endDate: null },
        now,
      ),
    ).toBe("scheduled");
  });

  test("past endDate reads as ended", () => {
    expect(
      getCampaignDisplayState(
        { status: "active", startDate: new Date("2026-06-01"), endDate: new Date("2026-07-01") },
        now,
      ),
    ).toBe("ended");
  });

  test("running or dateless campaigns are active", () => {
    expect(
      getCampaignDisplayState({ status: "active", startDate: null, endDate: null }, now),
    ).toBe("active");
    expect(
      getCampaignDisplayState(
        { status: "active", startDate: new Date("2026-06-01"), endDate: new Date("2026-08-01") },
        now,
      ),
    ).toBe("active");
  });
});
