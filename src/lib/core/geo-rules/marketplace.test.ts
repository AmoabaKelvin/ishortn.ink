import { describe, expect, test } from "bun:test";

import { buildAmazonStorefrontRules, parseAmazonUrl } from "./marketplace";

const PRODUCT = "https://www.amazon.com/Echo-Dot/dp/B09B8V1LZ3?th=1";

describe("parseAmazonUrl", () => {
  test("recognises every supported storefront", () => {
    for (const domain of [
      "amazon.com",
      "amazon.co.uk",
      "amazon.de",
      "amazon.ca",
      "amazon.fr",
      "amazon.it",
      "amazon.es",
      "amazon.in",
      "amazon.com.au",
    ]) {
      expect(parseAmazonUrl(`https://www.${domain}/dp/B09B8V1LZ3`)?.storefront.domain).toBe(domain);
    }
  });

  test("accepts bare and scheme-less hosts", () => {
    expect(parseAmazonUrl("amazon.co.uk/dp/B09B8V1LZ3")?.storefront.domain).toBe("amazon.co.uk");
    expect(parseAmazonUrl("https://AMAZON.DE/dp/X")?.storefront.domain).toBe("amazon.de");
    expect(parseAmazonUrl("https://smile.amazon.com/dp/X")?.storefront.domain).toBe("amazon.com");
  });

  test("keeps the path and query but drops the associate tag", () => {
    expect(parseAmazonUrl(`${PRODUCT}&tag=shop-20#reviews`)?.pathAndQuery).toBe(
      "/Echo-Dot/dp/B09B8V1LZ3?th=1#reviews",
    );
    expect(parseAmazonUrl("https://amazon.com/dp/X?tag=shop-20")?.pathAndQuery).toBe("/dp/X");
  });

  test("rejects non-Amazon, lookalike and home page URLs", () => {
    expect(parseAmazonUrl("https://example.com/dp/X")).toBeNull();
    expect(parseAmazonUrl("https://amazon.com.evil.io/dp/X")).toBeNull();
    expect(parseAmazonUrl("https://notamazon.com/dp/X")).toBeNull();
    expect(parseAmazonUrl("https://aws.amazon.com/ec2")).toBeNull();
    expect(parseAmazonUrl("https://www.amazon.com/")).toBeNull();
    expect(parseAmazonUrl("ftp://amazon.com/dp/X")).toBeNull();
    expect(parseAmazonUrl("")).toBeNull();
    expect(parseAmazonUrl("not a url")).toBeNull();
  });
});

describe("buildAmazonStorefrontRules", () => {
  test("maps an amazon.com product to the top other storefronts within the limit", () => {
    expect(buildAmazonStorefrontRules(PRODUCT, { maxRules: 3 })).toEqual([
      {
        storefront: "Amazon UK",
        type: "country",
        condition: "in",
        values: ["GB", "IE"],
        action: "redirect",
        destination: "https://www.amazon.co.uk/Echo-Dot/dp/B09B8V1LZ3?th=1",
      },
      {
        storefront: "Amazon Germany",
        type: "country",
        condition: "in",
        values: ["DE", "AT", "CH"],
        action: "redirect",
        destination: "https://www.amazon.de/Echo-Dot/dp/B09B8V1LZ3?th=1",
      },
      {
        storefront: "Amazon Canada",
        type: "country",
        condition: "in",
        values: ["CA"],
        action: "redirect",
        destination: "https://www.amazon.ca/Echo-Dot/dp/B09B8V1LZ3?th=1",
      },
    ]);
  });

  test("skips the source storefront and includes amazon.com for other stores", () => {
    const rules = buildAmazonStorefrontRules("https://www.amazon.de/dp/X", { maxRules: 2 });
    expect(rules.map((r) => r.destination)).toEqual([
      "https://www.amazon.com/dp/X",
      "https://www.amazon.co.uk/dp/X",
    ]);
  });

  test("returns every other storefront when unlimited", () => {
    const rules = buildAmazonStorefrontRules(PRODUCT);
    expect(rules).toHaveLength(8);
    expect(rules.some((r) => r.destination.includes("amazon.com/"))).toBe(false);
  });

  test("skips countries that existing rules already target", () => {
    const rules = buildAmazonStorefrontRules(PRODUCT, {
      existingCountries: ["gb", "AT"],
      maxRules: 2,
    });
    expect(rules.map((r) => r.values)).toEqual([["DE", "CH"], ["CA"]]);
  });

  test("returns nothing when there is no room or no Amazon URL", () => {
    expect(buildAmazonStorefrontRules(PRODUCT, { maxRules: 0 })).toEqual([]);
    expect(buildAmazonStorefrontRules("https://example.com/dp/X")).toEqual([]);
  });
});
