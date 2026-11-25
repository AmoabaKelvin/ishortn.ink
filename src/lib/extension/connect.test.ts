import { describe, expect, test } from "bun:test";

import wrangler from "../../../wrangler.jsonc";
import {
  browserFromLabel,
  connectResultUrl,
  parseConnectParams,
  parseRedirectUriList,
} from "./connect";

const CHROME_URI = "https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/";
const ALLOWED = [CHROME_URI, "https://0123abcd.extensions.allizom.org/"];
const STATE = "s".repeat(32);

describe("parseConnectParams", () => {
  test("accepts a configured redirect URI with a valid state and label", () => {
    expect(
      parseConnectParams(
        { redirect_uri: CHROME_URI, state: STATE, label: " Chrome on macOS " },
        ALLOWED,
      ),
    ).toEqual({
      ok: true,
      request: { redirectUri: CHROME_URI, state: STATE, label: "Chrome on macOS" },
    });
  });

  test.each([
    ["an unlisted host", "https://evil.example/"],
    ["a missing trailing slash", CHROME_URI.slice(0, -1)],
    ["an extra path", `${CHROME_URI}cb`],
    ["a query string", `${CHROME_URI}?x=1`],
    ["a different case", CHROME_URI.toUpperCase()],
    ["http instead of https", CHROME_URI.replace("https:", "http:")],
    ["an empty value", ""],
  ])("refuses %s", (_name, redirectUri) => {
    expect(parseConnectParams({ redirect_uri: redirectUri, state: STATE }, ALLOWED)).toEqual({
      ok: false,
      reason: "redirect_uri",
    });
  });

  test("refuses everything when no redirect URIs are configured", () => {
    expect(parseConnectParams({ redirect_uri: CHROME_URI, state: STATE }, [])).toEqual({
      ok: false,
      reason: "redirect_uri",
    });
  });

  test("refuses a repeated redirect_uri", () => {
    expect(
      parseConnectParams({ redirect_uri: [CHROME_URI, CHROME_URI], state: STATE }, ALLOWED).ok,
    ).toBe(false);
  });

  test.each([
    ["missing", undefined],
    ["too short", "s".repeat(15)],
    ["too long", "s".repeat(129)],
  ])("refuses a state that is %s", (_name, state) => {
    expect(parseConnectParams({ redirect_uri: CHROME_URI, state }, ALLOWED)).toEqual({
      ok: false,
      reason: "state",
    });
  });

  test("refuses a label over 64 characters and treats an empty one as none", () => {
    expect(
      parseConnectParams({ redirect_uri: CHROME_URI, state: STATE, label: "x".repeat(65) }, ALLOWED)
        .ok,
    ).toBe(false);
    expect(
      parseConnectParams({ redirect_uri: CHROME_URI, state: STATE, label: "  " }, ALLOWED),
    ).toEqual({ ok: true, request: { redirectUri: CHROME_URI, state: STATE, label: null } });
  });
});

describe("connectResultUrl", () => {
  test("puts the token and state in the fragment only", () => {
    const url = new URL(connectResultUrl(CHROME_URI, { token: "tok en", state: STATE }));
    expect(url.search).toBe("");
    expect(url.origin + url.pathname).toBe(CHROME_URI);
    const fragment = new URLSearchParams(url.hash.slice(1));
    expect(fragment.get("token")).toBe("tok en");
    expect(fragment.get("state")).toBe(STATE);
  });

  test("reports a cancel as access_denied", () => {
    expect(connectResultUrl(CHROME_URI, { error: "access_denied", state: STATE })).toBe(
      `${CHROME_URI}#error=access_denied&state=${STATE}`,
    );
  });
});

test("parseRedirectUriList trims and drops empty entries", () => {
  expect(parseRedirectUriList(` ${CHROME_URI} ,, https://b.example/ `)).toEqual([
    CHROME_URI,
    "https://b.example/",
  ]);
  expect(parseRedirectUriList(undefined)).toEqual([]);
});

describe("deployed EXTENSION_REDIRECT_URIS (wrangler.jsonc vars)", () => {
  const STORE_URI = "https://opkikfbhepmnlnblmjnfjgjeonadekdj.chromiumapp.org/";
  const deployed = parseRedirectUriList(wrangler.vars.EXTENSION_REDIRECT_URIS);

  test("accepts the Chrome Web Store build's redirect URI", () => {
    expect(parseConnectParams({ redirect_uri: STORE_URI, state: STATE }, deployed)).toEqual({
      ok: true,
      request: { redirectUri: STORE_URI, state: STATE, label: null },
    });
  });

  test.each([
    ["another chromiumapp.org extension ID", CHROME_URI],
    ["the store URI without its trailing slash", STORE_URI.slice(0, -1)],
  ])("refuses %s", (_name, redirectUri) => {
    expect(parseConnectParams({ redirect_uri: redirectUri, state: STATE }, deployed)).toEqual({
      ok: false,
      reason: "redirect_uri",
    });
  });
});

test("browserFromLabel", () => {
  expect(browserFromLabel("Chrome on macOS")).toBe("chrome");
  expect(browserFromLabel("Firefox on Linux")).toBe("firefox");
  expect(browserFromLabel("Netscape on BeOS")).toBe("unknown");
  expect(browserFromLabel(null)).toBe("unknown");
});
