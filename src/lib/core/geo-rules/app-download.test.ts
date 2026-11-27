import { describe, expect, test } from "bun:test";

import { getRuleDevice, matchLinkRules } from "@/middlewares/resolve-link";

import {
  buildAppDownloadPreset,
  detectAppStore,
  findAppDownloadRules,
  isAppStoreRule,
  parseStoreUrl,
  replaceAppStoreRules,
} from "./app-download";

import type { GeoRule } from "@/server/db/schema";

const APP_STORE = "https://apps.apple.com/us/app/ishortn/id1234567890";
const PLAY_STORE = "https://play.google.com/store/apps/details?id=ink.ishortn.app";
const WEBSITE = "https://ishortn.ink/app";

describe("parseStoreUrl", () => {
  test("accepts store links, adding https when missing", () => {
    expect(parseStoreUrl("appStore", APP_STORE)).toBe(APP_STORE);
    expect(parseStoreUrl("playStore", PLAY_STORE)).toBe(PLAY_STORE);
    expect(parseStoreUrl("appStore", "apps.apple.com/us/app/x/id1")).toBe(
      "https://apps.apple.com/us/app/x/id1",
    );
    expect(parseStoreUrl("appStore", "http://APPS.APPLE.COM/app/id1")).toBe(
      "https://apps.apple.com/app/id1",
    );
  });

  test("rejects other hosts, lookalikes, the wrong store and home pages", () => {
    expect(parseStoreUrl("appStore", PLAY_STORE)).toBeNull();
    expect(parseStoreUrl("playStore", APP_STORE)).toBeNull();
    expect(parseStoreUrl("appStore", "https://apps.apple.com.evil.io/app/id1")).toBeNull();
    expect(parseStoreUrl("appStore", "https://evil.io/apps.apple.com/app/id1")).toBeNull();
    expect(parseStoreUrl("playStore", "https://play.google.com/")).toBeNull();
    expect(parseStoreUrl("appStore", "javascript:alert(1)")).toBeNull();
    expect(parseStoreUrl("appStore", "")).toBeNull();
  });
});

describe("detectAppStore", () => {
  test("names the store a destination belongs to", () => {
    expect(detectAppStore(APP_STORE)).toBe("appStore");
    expect(detectAppStore(PLAY_STORE)).toBe("playStore");
    expect(detectAppStore(WEBSITE)).toBeNull();
  });
});

describe("buildAppDownloadPreset", () => {
  test("creates one OS rule per store with the fallback as destination", () => {
    expect(
      buildAppDownloadPreset({
        appStoreUrl: APP_STORE,
        playStoreUrl: PLAY_STORE,
        fallbackUrl: "ishortn.ink/app",
      }),
    ).toEqual({
      ok: true,
      destination: WEBSITE,
      rules: [
        {
          type: "os",
          condition: "in",
          values: ["ios"],
          action: "redirect",
          destination: APP_STORE,
        },
        {
          type: "os",
          condition: "in",
          values: ["android"],
          action: "redirect",
          destination: PLAY_STORE,
        },
      ],
    });
  });

  test("reports every invalid field at once", () => {
    const result = buildAppDownloadPreset({
      appStoreUrl: "https://example.com/app",
      playStoreUrl: "",
      fallbackUrl: "not a url",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual([
      "appStoreUrl",
      "fallbackUrl",
      "playStoreUrl",
    ]);
  });

  test("refuses a store link as the fallback", () => {
    const result = buildAppDownloadPreset({
      appStoreUrl: APP_STORE,
      playStoreUrl: PLAY_STORE,
      fallbackUrl: APP_STORE,
    });
    expect(result).toEqual({
      ok: false,
      errors: { fallbackUrl: "Use a website, not a store link, for other devices" },
    });
  });
});

describe("isAppStoreRule", () => {
  test("matches only include rules limited to iOS and Android", () => {
    expect(isAppStoreRule({ type: "os", condition: "in", values: ["ios"] })).toBe(true);
    expect(isAppStoreRule({ type: "os", condition: "in", values: ["ios", "android"] })).toBe(true);
    expect(isAppStoreRule({ type: "os", condition: "in", values: ["ios", "windows"] })).toBe(false);
    expect(isAppStoreRule({ type: "os", condition: "not_in", values: ["ios"] })).toBe(false);
    expect(isAppStoreRule({ type: "device", condition: "in", values: ["mobile"] })).toBe(false);
  });
});

describe("replaceAppStoreRules", () => {
  const preset = buildAppDownloadPreset({
    appStoreUrl: APP_STORE,
    playStoreUrl: PLAY_STORE,
    fallbackUrl: WEBSITE,
  });
  if (!preset.ok) throw new Error("preset should build");
  const countryRule = {
    type: "country" as const,
    condition: "in" as const,
    values: ["GB"],
    action: "redirect" as const,
    destination: "https://ishortn.ink/uk",
  };

  test("applying the preset twice leaves one pair of store rules", () => {
    const once = replaceAppStoreRules([countryRule], preset.rules);
    const twice = replaceAppStoreRules(once, preset.rules);
    expect(once).toHaveLength(3);
    expect(twice).toEqual(once);
  });

  test("an edited preset replaces the old store links", () => {
    const edited = buildAppDownloadPreset({
      appStoreUrl: "https://apps.apple.com/app/id999",
      playStoreUrl: PLAY_STORE,
      fallbackUrl: WEBSITE,
    });
    if (!edited.ok) throw new Error("preset should build");
    const rules = replaceAppStoreRules(preset.rules, edited.rules);
    expect(rules).toHaveLength(2);
    expect(findAppDownloadRules(rules)?.appStoreUrl).toBe("https://apps.apple.com/app/id999");
  });
});

describe("findAppDownloadRules", () => {
  const ios = { type: "os", condition: "in", values: ["ios"], destination: APP_STORE };
  const android = { type: "os", condition: "in", values: ["android"], destination: PLAY_STORE };

  test("returns the store links once both phones have a store rule", () => {
    expect(findAppDownloadRules([ios, android])).toEqual({
      appStoreUrl: APP_STORE,
      playStoreUrl: PLAY_STORE,
    });
  });

  test("is null until both rules exist", () => {
    expect(findAppDownloadRules([])).toBeNull();
    expect(findAppDownloadRules([ios])).toBeNull();
    expect(findAppDownloadRules([android])).toBeNull();
  });

  test("ignores rules that don't send each phone to its own store", () => {
    expect(findAppDownloadRules([{ ...ios, destination: WEBSITE }, android])).toBeNull();
    expect(findAppDownloadRules([{ ...ios, destination: PLAY_STORE }, android])).toBeNull();
    expect(findAppDownloadRules([{ ...ios, condition: "not_in" }, android])).toBeNull();
  });
});

describe("app download redirect", () => {
  const preset = buildAppDownloadPreset({
    appStoreUrl: APP_STORE,
    playStoreUrl: PLAY_STORE,
    fallbackUrl: WEBSITE,
  });
  if (!preset.ok) throw new Error("preset should build");

  // Saved the way the link services store them: one row per rule, priority by position.
  const rules: GeoRule[] = preset.rules.map((rule, index) => ({
    ...rule,
    id: index + 1,
    linkId: 1,
    blockMessage: null,
    priority: index,
    createdAt: null,
  }));

  // Same steps as resolveShortLink: parse the UA only because OS rules exist, then match;
  // no match means the link's own destination (the fallback).
  async function destinationFor(userAgent: string) {
    const device = await getRuleDevice(rules, new Headers({ "user-agent": userAgent }));
    const result = matchLinkRules(rules, "US", device);
    return result.matched && result.action === "redirect" ? result.destination : preset.destination;
  }

  test("iPhone and iPad go to the App Store", async () => {
    expect(
      await destinationFor(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
      ),
    ).toBe(APP_STORE);
    expect(
      await destinationFor(
        "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
      ),
    ).toBe(APP_STORE);
  });

  test("Android goes to Google Play", async () => {
    expect(
      await destinationFor(
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
      ),
    ).toBe(PLAY_STORE);
  });

  test("desktop goes to the fallback website", async () => {
    expect(
      await destinationFor(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      ),
    ).toBe(WEBSITE);
    expect(
      await destinationFor(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
      ),
    ).toBe(WEBSITE);
  });
});
