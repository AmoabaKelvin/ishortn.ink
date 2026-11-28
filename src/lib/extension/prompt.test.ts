import { describe, expect, it } from "bun:test";

import { CHROME_WEB_STORE_URL } from "@/lib/constants/extension";

import { isDesktopChromium, LINK_READY_STORE_URL } from "./prompt";

const USER_AGENTS = {
  chromeMac:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  chromeWindows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  edgeWindows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
  chromiumLinux:
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chromium/131.0.0.0 Chrome/131.0.0.0 Safari/537.36",
  safariMac:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
  firefoxWindows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
  chromeAndroid:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
  chromeAndroidTablet:
    "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  chromeIphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1",
  edgeIphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 EdgiOS/131.0.2903.68 Mobile/15E148 Safari/605.1.15",
};

describe("isDesktopChromium", () => {
  it("accepts desktop Chrome, Edge and Chromium", () => {
    expect(isDesktopChromium(USER_AGENTS.chromeMac)).toBe(true);
    expect(isDesktopChromium(USER_AGENTS.chromeWindows)).toBe(true);
    expect(isDesktopChromium(USER_AGENTS.edgeWindows)).toBe(true);
    expect(isDesktopChromium(USER_AGENTS.chromiumLinux)).toBe(true);
  });

  it("rejects Safari, Firefox and mobile browsers", () => {
    expect(isDesktopChromium(USER_AGENTS.safariMac)).toBe(false);
    expect(isDesktopChromium(USER_AGENTS.firefoxWindows)).toBe(false);
    expect(isDesktopChromium(USER_AGENTS.chromeAndroid)).toBe(false);
    expect(isDesktopChromium(USER_AGENTS.chromeAndroidTablet)).toBe(false);
    expect(isDesktopChromium(USER_AGENTS.chromeIphone)).toBe(false);
    expect(isDesktopChromium(USER_AGENTS.edgeIphone)).toBe(false);
  });
});

describe("LINK_READY_STORE_URL", () => {
  it("tags the store link for the link-ready dialog", () => {
    const url = new URL(LINK_READY_STORE_URL);
    expect(`${url.origin}${url.pathname}`).toBe(CHROME_WEB_STORE_URL);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      utm_source: "dashboard",
      utm_medium: "in_app",
      utm_campaign: "extension_launch",
      utm_content: "link_ready",
    });
  });
});
