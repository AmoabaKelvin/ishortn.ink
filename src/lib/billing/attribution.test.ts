import { describe, expect, test } from "bun:test";

import {
  checkoutCustomData,
  checkoutEventProperties,
  checkoutSource,
  readAttribution,
  utmTags,
  withAttribution,
} from "./attribution";

describe("readAttribution", () => {
  test("keeps the source and UTM params, trimmed, and ignores the rest", () => {
    const params = new URLSearchParams(
      "utm_source=browser-extension&utm_medium=%20popup%20&utm_campaign=&plan=pro&ref=x",
    );
    expect(readAttribution(params)).toEqual({
      utm_source: "browser-extension",
      utm_medium: "popup",
    });
  });

  test("caps each value at the stored column length", () => {
    const params = new URLSearchParams({ utm_campaign: "a".repeat(200) });
    expect(readAttribution(params).utm_campaign).toHaveLength(64);
  });

  test("no params read as no attribution", () => {
    expect(readAttribution(null)).toEqual({});
  });
});

describe("withAttribution", () => {
  test("appends to an existing query", () => {
    expect(
      withAttribution("/dashboard/pricing?plan=pro&interval=annual", {
        utm_source: "browser-extension",
        utm_campaign: "black friday",
      }),
    ).toBe(
      "/dashboard/pricing?plan=pro&interval=annual&utm_source=browser-extension&utm_campaign=black+friday",
    );
  });

  test("leaves the path alone without attribution", () => {
    expect(withAttribution("/dashboard/pricing?plan=pro", {})).toBe("/dashboard/pricing?plan=pro");
  });
});

describe("checkoutSource", () => {
  test("an in-app source wins over the campaign's utm_source", () => {
    expect(checkoutSource({ source: "folder_create", utm_source: "newsletter" })).toBe(
      "folder_create",
    );
  });

  test("utm_source wins over the fallback", () => {
    expect(checkoutSource({ utm_source: "browser-extension" }, "auto_signup")).toBe(
      "browser-extension",
    );
  });

  test("falls back when nothing was carried", () => {
    expect(checkoutSource({}, "auto_signup")).toBe("auto_signup");
    expect(checkoutSource({})).toBeUndefined();
  });
});

test("utmTags drops the source", () => {
  expect(utmTags({ source: "x", utm_source: "y" })).toEqual({ utm_source: "y" });
});

test("checkoutCustomData carries the user, attribution and discount code", () => {
  expect(checkoutCustomData("user_1", { source: "browser-extension" }, "BFCM20")).toEqual({
    user_id: "user_1",
    source: "browser-extension",
    discount_code: "BFCM20",
  });
  expect(checkoutCustomData("user_1", {}, undefined)).toEqual({ user_id: "user_1" });
});

test("checkoutEventProperties drops unset values but keeps zero and false", () => {
  expect(
    checkoutEventProperties({
      plan: "pro",
      discount_code: null,
      source: "",
      amount: 0,
      test: false,
    }),
  ).toEqual({ plan: "pro", amount: 0, test: false });
});
