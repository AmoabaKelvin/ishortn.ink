import { describe, expect, test } from "bun:test";

import {
  buildFirstTouch,
  FIRST_TOUCH_MAX_AGE_SECONDS,
  isDirectTouch,
  serializeFirstTouch,
} from "./first-touch";
import { parseFirstTouch } from "./parse-first-touch";
import { getBioReferralUrl } from "./referral";

const NOW = new Date("2026-11-20T12:00:00Z");

describe("buildFirstTouch", () => {
  test("captures UTMs, click ID and landing path without the query", () => {
    const touch = buildFirstTouch({
      url: "https://ishortn.ink/compare/bitly?utm_source=google&utm_medium=cpc&utm_campaign=test&gclid=abc&other=x",
      referrer: "https://www.google.com/",
      now: NOW.getTime(),
    });
    expect(touch).toEqual({
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "test",
      gclid: "abc",
      landingPath: "/compare/bitly",
      referrerHost: "www.google.com",
      ts: NOW.getTime(),
    });
  });

  test("attributes a visit from a bio page footer link", () => {
    const touch = buildFirstTouch({
      url: getBioReferralUrl("jane"),
      referrer: "https://isht.app/p/jane",
      now: NOW.getTime(),
    });
    expect(touch).toEqual({
      utm_source: "bio_page",
      utm_medium: "referral",
      utm_campaign: "made_with_ishortn",
      utm_content: "jane",
      landingPath: "/",
      referrerHost: "isht.app",
      ts: NOW.getTime(),
    });
  });

  test("drops a same-site referrer", () => {
    const touch = buildFirstTouch({
      url: "https://ishortn.ink/pricing?utm_source=newsletter",
      referrer: "https://accounts.ishortn.ink/sign-in",
      now: NOW.getTime(),
    });
    expect(touch.referrerHost).toBe("");
  });

  test("records an external referrer alone when no params are present", () => {
    const touch = buildFirstTouch({
      url: "https://ishortn.ink/",
      referrer: "https://news.ycombinator.com/item?id=1",
      now: NOW.getTime(),
    });
    expect(touch).toEqual({
      landingPath: "/",
      referrerHost: "news.ycombinator.com",
      ts: NOW.getTime(),
    });
  });

  test("records a direct visit with only the landing path", () => {
    const direct = { landingPath: "/pricing", referrerHost: "", ts: 1 };
    expect(buildFirstTouch({ url: "https://ishortn.ink/pricing", referrer: "", now: 1 })).toEqual(
      direct,
    );
    expect(
      buildFirstTouch({
        url: "https://ishortn.ink/pricing",
        referrer: "https://ishortn.ink/blog",
        now: 1,
      }),
    ).toEqual(direct);
  });

  test("ignores the referrer on auth pages", () => {
    expect(
      buildFirstTouch({
        url: "https://ishortn.ink/auth/sign-up/sso-callback",
        referrer: "https://accounts.google.com/",
        now: 1,
      }),
    ).toEqual({ landingPath: "/auth/sign-up/sso-callback", referrerHost: "", ts: 1 });
    expect(
      buildFirstTouch({
        url: "https://ishortn.ink/auth/sign-in",
        referrer: "https://mail.google.com/",
        now: 1,
      }).referrerHost,
    ).toBe("");
  });

  test("still captures tracked params on auth pages", () => {
    const touch = buildFirstTouch({
      url: "https://ishortn.ink/auth/sign-up?utm_source=reddit",
      referrer: "https://www.reddit.com/",
      now: 1,
    });
    expect(touch.utm_source).toBe("reddit");
    expect(touch.landingPath).toBe("/auth/sign-up");
  });

  test("trims oversized values to 255 chars", () => {
    const touch = buildFirstTouch({
      url: `https://ishortn.ink/?utm_campaign=${"a".repeat(400)}`,
      referrer: "",
      now: 1,
    });
    expect(touch.utm_campaign).toHaveLength(255);
  });
});

describe("parseFirstTouch", () => {
  test("round-trips a built cookie", () => {
    const built = buildFirstTouch({
      url: "https://ishortn.ink/compare/bitly?utm_source=google&utm_medium=cpc&utm_campaign=test&gclid=abc",
      referrer: "",
      now: NOW.getTime() - 1000,
    });
    if (!built) throw new Error("expected a cookie");
    expect(parseFirstTouch(serializeFirstTouch(built), NOW)).toEqual({
      utmSource: "google",
      utmMedium: "cpc",
      utmCampaign: "test",
      utmTerm: null,
      utmContent: null,
      clickId: "abc",
      clickIdType: "gclid",
      landingPath: "/compare/bitly",
      referrerHost: null,
      firstSeenAt: new Date(NOW.getTime() - 1000),
    });
  });

  test("keeps a direct touch and drops one with nothing at all", () => {
    const direct = parseFirstTouch(
      serializeFirstTouch({ landingPath: "/", referrerHost: "", ts: NOW.getTime() }),
      NOW,
    );
    expect(direct?.landingPath).toBe("/");
    expect(direct && isDirectTouch(direct)).toBe(true);
    expect(parseFirstTouch(encodeURIComponent("{}"), NOW)).toBeNull();
    expect(
      parseFirstTouch(encodeURIComponent(JSON.stringify({ landingPath: "x" })), NOW),
    ).toBeNull();
  });

  test("returns null for malformed input", () => {
    expect(parseFirstTouch("%E0%A4%A", NOW)).toBeNull();
    expect(parseFirstTouch("not json", NOW)).toBeNull();
    expect(parseFirstTouch(encodeURIComponent("[1,2]"), NOW)).toBeNull();
    expect(parseFirstTouch(encodeURIComponent("null"), NOW)).toBeNull();
    expect(parseFirstTouch(encodeURIComponent('"text"'), NOW)).toBeNull();
  });

  test("ignores unknown keys and non-string values", () => {
    const raw = encodeURIComponent(
      JSON.stringify({ utm_source: 42, evil: "x", landingPath: "/", ts: NOW.getTime() }),
    );
    expect(parseFirstTouch(raw, NOW)?.utmSource).toBeNull();

    const touch = parseFirstTouch(
      encodeURIComponent(JSON.stringify({ utm_source: "x", evil: "y", userId: "user_2" })),
      NOW,
    );
    expect(touch).not.toBeNull();
    expect(Object.keys(touch ?? {})).not.toContain("evil");
    expect(Object.keys(touch ?? {})).not.toContain("userId");
  });

  test("trims oversized values and drops blanks", () => {
    const touch = parseFirstTouch(
      encodeURIComponent(
        JSON.stringify({ utm_campaign: ` ${"b".repeat(1000)} `, utm_source: "   " }),
      ),
      NOW,
    );
    expect(touch?.utmCampaign).toHaveLength(255);
    expect(touch?.utmSource).toBeNull();
  });

  test("picks the first click ID by priority", () => {
    const touch = parseFirstTouch(
      encodeURIComponent(JSON.stringify({ fbclid: "fb", msclkid: "ms" })),
      NOW,
    );
    expect(touch?.clickIdType).toBe("msclkid");
    expect(touch?.clickId).toBe("ms");
  });

  test("rejects a landing path that is not a path", () => {
    const touch = parseFirstTouch(
      encodeURIComponent(JSON.stringify({ utm_source: "x", landingPath: "https://evil.example" })),
      NOW,
    );
    expect(touch?.landingPath).toBeNull();
  });

  test("falls back to now for missing, future or stale timestamps", () => {
    const parse = (ts: number | string | undefined) =>
      parseFirstTouch(encodeURIComponent(JSON.stringify({ utm_source: "x", ts })), NOW)
        ?.firstSeenAt;
    expect(parse(undefined)).toEqual(NOW);
    expect(parse("123")).toEqual(NOW);
    expect(parse(NOW.getTime() + 60_000)).toEqual(NOW);
    expect(parse(NOW.getTime() - FIRST_TOUCH_MAX_AGE_SECONDS * 1000 - 1)).toEqual(NOW);
  });
});
