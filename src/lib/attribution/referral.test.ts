import { describe, expect, test } from "bun:test";

import { getBioReferralUrl, getSharedStatsReferralUrl, withProductUtm } from "./referral";

describe("getBioReferralUrl", () => {
  test("tags the homepage with the bio page slug", () => {
    expect(getBioReferralUrl("jane")).toBe(
      "https://ishortn.ink/?utm_source=bio_page&utm_medium=referral&utm_campaign=made_with_ishortn&utm_content=jane",
    );
  });

  test("encodes the slug", () => {
    expect(getBioReferralUrl("a b&c")).toEndWith("utm_content=a+b%26c");
  });
});

describe("getSharedStatsReferralUrl", () => {
  test("tags the homepage as a shared stats page referral", () => {
    expect(getSharedStatsReferralUrl()).toBe(
      "https://ishortn.ink/?utm_source=shared_stats&utm_medium=referral&utm_campaign=made_with_ishortn",
    );
  });
});

describe("withProductUtm", () => {
  test("adds product UTMs to a path", () => {
    expect(withProductUtm("/changelog", "app", "changelog_banner")).toBe(
      "/changelog?utm_source=product&utm_medium=app&utm_campaign=changelog_banner",
    );
  });

  test("appends to an existing query", () => {
    expect(withProductUtm("https://ishortn.ink/pricing?plan=pro", "email", "x")).toBe(
      "https://ishortn.ink/pricing?plan=pro&utm_source=product&utm_medium=email&utm_campaign=x",
    );
  });
});
