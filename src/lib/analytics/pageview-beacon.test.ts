import { describe, expect, test } from "bun:test";

import {
  buildBeaconBody,
  isLikelyBot,
  postHogPersistenceName,
  resolveBeaconIdentity,
  uuidv7,
} from "./pageview-beacon";

const TOKEN = "phc_test+key/1=";
const NOW = Date.UTC(2026, 10, 26, 12, 0, 0);
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

interface StoredPersistence {
  distinct_id?: string | null;
  $device_id?: string;
  $sesid?: [number, string | null, number];
}

function persistenceCookie(value: StoredPersistence) {
  return `other=1; ${postHogPersistenceName(TOKEN)}=${encodeURIComponent(JSON.stringify(value))}`;
}

function decode(body: string) {
  const bytes = Uint8Array.from(atob(body), (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

const context = {
  title: "Bitly alternatives",
  search: "",
  referrer: "https://www.google.com/",
  userAgent: "Mozilla/5.0 (Linux; Android 14)",
  screen: { width: 390, height: 844 },
  viewport: { width: 390, height: 700 },
};

describe("postHogPersistenceName", () => {
  test("escapes the token the way posthog-js does", () => {
    expect(postHogPersistenceName(TOKEN)).toBe("ph_phc_testPLkeySL1EQ_posthog");
  });
});

describe("isLikelyBot", () => {
  test("skips crawlers, audits and automated browsers", () => {
    expect(
      isLikelyBot(
        "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36 Chrome-Lighthouse",
        false,
      ),
    ).toBe(true);
    expect(
      isLikelyBot(
        "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        false,
      ),
    ).toBe(true);
    expect(isLikelyBot("Mozilla/5.0 HeadlessChrome/140.0.0.0", false)).toBe(true);
    expect(isLikelyBot(context.userAgent, true)).toBe(true);
  });

  test("keeps ordinary browsers", () => {
    expect(isLikelyBot(context.userAgent, false)).toBe(false);
    expect(
      isLikelyBot(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
        false,
      ),
    ).toBe(false);
  });
});

describe("uuidv7", () => {
  test("is a version 7 UUID that starts with the timestamp", () => {
    const id = uuidv7(NOW);
    expect(id).toMatch(UUID_V7);
    expect(Number.parseInt(id.replace("-", "").slice(0, 12), 16)).toBe(NOW);
  });
});

describe("resolveBeaconIdentity", () => {
  test("reuses the stored distinct id, device id and active session", () => {
    const cookie = persistenceCookie({
      distinct_id: "user_1",
      $device_id: "device-1",
      $sesid: [NOW - 60_000, "session-1", NOW - 600_000],
    });
    expect(resolveBeaconIdentity(TOKEN, cookie, null, NOW)).toEqual({
      distinctId: "user_1",
      deviceId: "device-1",
      sessionId: "session-1",
      bootstrap: { distinctId: false, sessionId: false },
    });
  });

  test("starts a new session when the stored one has been idle for over 30 minutes", () => {
    const cookie = persistenceCookie({
      distinct_id: "anon-1",
      $sesid: [NOW - 31 * 60_000, "session-1", NOW - 40 * 60_000],
    });
    const identity = resolveBeaconIdentity(TOKEN, cookie, null, NOW);
    expect(identity.distinctId).toBe("anon-1");
    expect(identity.deviceId).toBe("anon-1");
    expect(identity.sessionId).toMatch(UUID_V7);
    expect(identity.bootstrap).toEqual({ distinctId: false, sessionId: true });
  });

  test("falls back to localStorage, then to new ids", () => {
    const stored = JSON.stringify({ distinct_id: "anon-2" });
    expect(resolveBeaconIdentity(TOKEN, "other=1", stored, NOW).distinctId).toBe("anon-2");

    const fresh = resolveBeaconIdentity(TOKEN, `${postHogPersistenceName(TOKEN)}=%E0`, null, NOW);
    expect(fresh.distinctId).toMatch(UUID_V7);
    expect(fresh.deviceId).toBe(fresh.distinctId);
    expect(fresh.bootstrap).toEqual({ distinctId: true, sessionId: true });
  });

  test("never bootstraps a distinct id over stored state it couldn't read", () => {
    const cookie = persistenceCookie({ distinct_id: null, $sesid: [NOW, null, NOW] });
    const identity = resolveBeaconIdentity(TOKEN, cookie, null, NOW);
    expect(identity.distinctId).toMatch(UUID_V7);
    expect(identity.bootstrap).toEqual({ distinctId: false, sessionId: true });
  });
});

describe("buildBeaconBody", () => {
  test("encodes each page view as a PostHog event with its campaign parameters", () => {
    const identity = {
      distinctId: "anon-1",
      deviceId: "anon-1",
      sessionId: "session-1",
      bootstrap: { distinctId: false, sessionId: false },
    };
    const timestamp = new Date(NOW);
    const body = buildBeaconBody(
      TOKEN,
      identity,
      [
        {
          properties: {
            $current_url: "https://ishortn.ink/blog/bitly-alternatives?utm_source=reddit&x=1",
            $host: "ishortn.ink",
            $pathname: "/blog/bitly-alternatives",
          },
          timestamp,
        },
      ],
      { ...context, title: "Ünïcode — title", search: "?utm_source=reddit&x=1" },
    );

    const [event, ...rest] = decode(body);
    expect(rest).toEqual([]);
    expect(event.event).toBe("$pageview");
    expect(event.uuid).toMatch(UUID_V7);
    expect(event.timestamp).toBe(timestamp.toISOString());
    expect(event.properties).toMatchObject({
      token: TOKEN,
      distinct_id: "anon-1",
      $device_id: "anon-1",
      $session_id: "session-1",
      $pathname: "/blog/bitly-alternatives",
      $title: "Ünïcode — title",
      $referrer: "https://www.google.com/",
      $referring_domain: "www.google.com",
      utm_source: "reddit",
    });
    expect(event.properties.x).toBeUndefined();
  });

  test("marks a visit without a referrer as direct", () => {
    const identity = resolveBeaconIdentity(TOKEN, "", null, NOW);
    const [event] = decode(
      buildBeaconBody(TOKEN, identity, [{ properties: {}, timestamp: new Date(NOW) }], {
        ...context,
        referrer: "",
      }),
    );
    expect(event.properties.$referrer).toBe("$direct");
    expect(event.properties.$referring_domain).toBe("$direct");
  });
});
