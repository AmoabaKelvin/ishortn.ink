import { describe, expect, mock, test } from "bun:test";

import { TRPCError } from "@trpc/server";

import { parseScrapedPage } from "@/server/lib/metadata";
import { ServerTiming } from "@/server/lib/server-timing";

import {
  LOOKALIKE_HOST_REASON,
  USER_MSG_UNSAFE,
  assertUrlSafe,
  assertUrlSafeFast,
  canDeferLlmCheck,
  checkUrlWithLlm,
  runPreLLMChecks,
} from "./index";

import type { PreLLMCheckDeps, SafetyAccount, UrlSafetyDeps } from "./index";

const PAGE = parseScrapedPage(
  "<html><head><title>Example</title></head><body><p>Hello</p></body></html>",
  "https://example.com/landing",
  200,
  new Headers(),
);
const PASS = { blocked: false, reason: "", userMessage: "" };
const BLOCKLISTED = {
  blocked: true,
  reason: 'Domain "github.com" is on the blocklist',
  userMessage: "This URL belongs to a domain that has been blocked.",
};
const SAFE_BROWSING_FLAGGED = {
  blocked: true,
  reason: "Google Safe Browsing flagged this URL: SOCIAL_ENGINEERING",
  userMessage: USER_MSG_UNSAFE,
};

function fakeDeps(overrides: UrlSafetyDeps = {}) {
  const deps = {
    preChecks: mock(async (_url: string) => PASS),
    scrape: mock(async (_url: string) => PAGE),
    detect: mock(async (url: string) => ({ url, phishing: false })),
    readVerdict: mock(async (_url: string) => false),
    rememberVerdict: mock((_url: string) => {}),
    ...overrides,
  };
  return deps;
}

async function rejection(promise: Promise<unknown>): Promise<TRPCError | null> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof TRPCError) return error;
    throw error;
  }
  return null;
}

describe("assertUrlSafe on an unlisted, uncached URL", () => {
  const url = "https://example.com/landing";

  test("scrapes alongside the pre-LLM checks, runs the LLM and caches the safe verdict", async () => {
    let scrapeStarted!: () => void;
    const scrapeStartedPromise = new Promise<void>((resolve) => (scrapeStarted = resolve));
    const deps = fakeDeps({
      scrape: mock(async () => {
        scrapeStarted();
        return PAGE;
      }),
      // Resolves only once the scrape has started, so this would hang if the steps were serial.
      preChecks: mock(async () => {
        await scrapeStartedPromise;
        return PASS;
      }),
    });

    await assertUrlSafe(url, deps);

    expect(deps.readVerdict).toHaveBeenCalledWith(url);
    expect(deps.detect).toHaveBeenCalledWith(url, PAGE.metadata, PAGE.signals);
    expect(deps.rememberVerdict).toHaveBeenCalledWith(url);
  });

  test("discards the scrape when the pre-LLM checks block", async () => {
    const deps = fakeDeps({ preChecks: mock(async () => SAFE_BROWSING_FLAGGED) });

    const error = await rejection(assertUrlSafe(url, deps));

    expect(error?.message).toBe(USER_MSG_UNSAFE);
    expect(deps.scrape).toHaveBeenCalledTimes(1);
    expect(deps.detect).not.toHaveBeenCalled();
    expect(deps.rememberVerdict).not.toHaveBeenCalled();
  });

  test("a failing scrape is discarded too when the pre-LLM checks block", async () => {
    const deps = fakeDeps({
      preChecks: mock(async () => BLOCKLISTED),
      scrape: mock(async () => {
        throw new Error("fetch failed");
      }),
    });

    const error = await rejection(assertUrlSafe(url, deps));

    expect(error?.message).toBe(BLOCKLISTED.userMessage);
    expect(deps.detect).not.toHaveBeenCalled();
  });

  test("never fetches a URL the heuristics reject", async () => {
    const deps = fakeDeps({ preChecks: mock(async () => BLOCKLISTED) });

    await rejection(assertUrlSafe("http://192.168.10.20/login", deps));

    expect(deps.readVerdict).not.toHaveBeenCalled();
    expect(deps.scrape).not.toHaveBeenCalled();
  });

  test("blocks when the LLM flags phishing and does not cache", async () => {
    const deps = fakeDeps({ detect: mock(async () => ({ url, phishing: true })) });

    const error = await rejection(assertUrlSafe(url, deps));

    expect(error?.message).toBe(USER_MSG_UNSAFE);
    expect(deps.rememberVerdict).not.toHaveBeenCalled();
  });

  test("fails open without caching when the LLM call fails", async () => {
    const deps = fakeDeps({
      detect: mock(async () => {
        throw new Error("timeout");
      }),
    });

    await assertUrlSafe(url, deps);

    expect(deps.rememberVerdict).not.toHaveBeenCalled();
  });

  test("fails open without the LLM or caching when the scrape fails", async () => {
    const deps = fakeDeps({
      scrape: mock(async () => {
        throw new Error("fetch failed");
      }),
    });

    await assertUrlSafe(url, deps);

    expect(deps.detect).not.toHaveBeenCalled();
    expect(deps.rememberVerdict).not.toHaveBeenCalled();
  });

  test("treats a failing verdict read as a miss", async () => {
    const deps = fakeDeps({
      readVerdict: mock(async () => {
        throw new Error("KV down");
      }),
    });

    await assertUrlSafe(url, deps);

    expect(deps.detect).toHaveBeenCalledTimes(1);
  });
});

describe("assertUrlSafe on a cached URL", () => {
  const url = "https://example.com/seen-before";

  test("skips the scrape and the LLM but still runs the pre-LLM checks", async () => {
    const deps = fakeDeps({ readVerdict: mock(async () => true) });

    await assertUrlSafe(url, deps);

    expect(deps.preChecks).toHaveBeenCalledTimes(1);
    expect(deps.scrape).not.toHaveBeenCalled();
    expect(deps.detect).not.toHaveBeenCalled();
    expect(deps.rememberVerdict).not.toHaveBeenCalled();
  });

  test("is still blocked when its domain was blocklisted after the verdict was cached", async () => {
    const deps = fakeDeps({
      readVerdict: mock(async () => true),
      preChecks: mock(async () => BLOCKLISTED),
    });

    const error = await rejection(assertUrlSafe(url, deps));

    expect(error?.message).toBe(BLOCKLISTED.userMessage);
  });
});

describe("assertUrlSafe on a well-known host", () => {
  const url = "https://github.com/AmoabaKelvin/ishortn.ink";

  test("skips the cache read, the scrape and the LLM", async () => {
    const deps = fakeDeps();

    await assertUrlSafe(url, deps);

    expect(deps.preChecks).toHaveBeenCalledTimes(1);
    expect(deps.readVerdict).not.toHaveBeenCalled();
    expect(deps.scrape).not.toHaveBeenCalled();
    expect(deps.detect).not.toHaveBeenCalled();
  });

  test.each([
    ["the blocklist", BLOCKLISTED],
    ["Safe Browsing", SAFE_BROWSING_FLAGGED],
  ])("is still blocked by %s", async (_name, result) => {
    const deps = fakeDeps({ preChecks: mock(async () => result) });

    const error = await rejection(assertUrlSafe(url, deps));

    expect(error?.message).toBe(result.userMessage);
  });

  test.each([
    "https://www.youtube.com/redirect?q=https%3A%2F%2Fevil.example%2Flogin",
    "https://www.linkedin.com/redir/redirect?url=https%3A%2F%2Fevil.example",
  ])("an open redirect on a listed host gets the full pipeline: %s", async (redirect) => {
    const deps = fakeDeps();

    await assertUrlSafe(redirect, deps);

    expect(deps.scrape).toHaveBeenCalledTimes(1);
    expect(deps.detect).toHaveBeenCalledTimes(1);
  });

  test("a subdomain of a listed host gets the full pipeline", async () => {
    const deps = fakeDeps();

    await assertUrlSafe("https://someone.github.io/login", deps);

    expect(deps.detect).toHaveBeenCalledTimes(1);
  });
});

describe("runPreLLMChecks", () => {
  const url = "https://example.com/landing";
  const NOT_LISTED = { blocked: false, reason: "" };

  function fakeChecks(overrides: PreLLMCheckDeps = {}) {
    return {
      blocklist: mock(async (_url: string) => NOT_LISTED),
      safeBrowsing: mock(async (_url: string) => ({ status: "safe" as const })),
      webRisk: mock(async (_url: string) => ({ status: "safe" as const })),
      ...overrides,
    };
  }

  test("queries the blocklist and Safe Browsing at the same time", async () => {
    let safeBrowsingStarted!: () => void;
    const started = new Promise<void>((resolve) => (safeBrowsingStarted = resolve));
    const checks = fakeChecks({
      safeBrowsing: mock(async () => {
        safeBrowsingStarted();
        return { status: "safe" as const };
      }),
      // Resolves only once Safe Browsing has started, so this would hang if the steps were serial.
      blocklist: mock(async () => {
        await started;
        return NOT_LISTED;
      }),
    });

    expect((await runPreLLMChecks(url, {}, checks)).blocked).toBe(false);
  });

  test("a blocklist hit wins over a safe Safe Browsing verdict", async () => {
    const checks = fakeChecks({
      blocklist: mock(async () => ({ blocked: true, reason: BLOCKLISTED.reason })),
    });

    const result = await runPreLLMChecks(url, {}, checks);

    expect(result.blocked).toBe(true);
    expect(result.reason).toBe(BLOCKLISTED.reason);
    expect(result.userMessage).toContain("blocked");
  });

  test("blocks a URL Safe Browsing flags", async () => {
    const checks = fakeChecks({
      safeBrowsing: mock(async () => ({
        status: "unsafe" as const,
        threats: ["SOCIAL_ENGINEERING"],
      })),
    });

    expect(await runPreLLMChecks(url, {}, checks)).toEqual(SAFE_BROWSING_FLAGGED);
    expect(checks.webRisk).not.toHaveBeenCalled();
  });

  test("falls back to Web Risk only when Safe Browsing errors", async () => {
    const checks = fakeChecks({
      safeBrowsing: mock(async () => ({ status: "error" as const })),
      webRisk: mock(async () => ({ status: "unsafe" as const, threats: ["MALWARE"] })),
    });

    const result = await runPreLLMChecks(url, {}, checks);

    expect(result.blocked).toBe(true);
    expect(result.reason).toContain("Web Risk");
    expect(checks.webRisk).toHaveBeenCalledTimes(1);
  });

  test("rejects a heuristic match without any lookup", async () => {
    const checks = fakeChecks();

    expect((await runPreLLMChecks("not a url", {}, checks)).blocked).toBe(true);
    expect(checks.blocklist).not.toHaveBeenCalled();
    expect(checks.safeBrowsing).not.toHaveBeenCalled();
  });
});

describe("assertUrlSafe Server-Timing", () => {
  const url = "https://example.com/landing";

  test("reports the outcome and every finished step", async () => {
    const timing = new ServerTiming();
    await assertUrlSafe(url, fakeDeps(), timing);

    const names = timing
      .header()
      .split(", ")
      .map((metric) => metric.split(";")[0]);
    expect(names).toEqual(["safety", "verdictcache", "scrape", "llm", "total"]);
    expect(timing.header()).toContain('desc="allowed"');
  });

  test("still reports when the pre-LLM checks block", async () => {
    const timing = new ServerTiming();
    const deps = fakeDeps({
      preChecks: mock(async (_url: string, timings = {}) => {
        timings.deterministicMs = 4;
        return SAFE_BROWSING_FLAGGED;
      }),
    });

    expect((await rejection(assertUrlSafe(url, deps, timing)))?.message).toBe(USER_MSG_UNSAFE);
    expect(timing.header()).toMatch(
      /^safety;dur=\d+;desc="blocked-pre-llm", deterministic;dur=4, (.+, )?total;dur=\d+$/,
    );
    expect(timing.header()).not.toContain("example.com");
  });
});

describe("assertUrlSafeFast", () => {
  const url = "https://example.com/landing";

  test("runs only the pre-LLM checks and reports their timings", async () => {
    const timing = new ServerTiming();
    const preChecks = mock(async (_url: string, timings = {}) => {
      timings.deterministicMs = 3;
      timings.safeBrowsingMs = 5;
      return PASS;
    });

    await assertUrlSafeFast(url, { preChecks }, timing);

    expect(preChecks).toHaveBeenCalledTimes(1);
    const names = timing
      .header()
      .split(", ")
      .map((metric) => metric.split(";")[0]);
    expect(names).toEqual(["safety", "deterministic", "safebrowsing", "total"]);
  });

  test.each([
    ["the blocklist", BLOCKLISTED],
    ["Safe Browsing", SAFE_BROWSING_FLAGGED],
  ])("rejects with the message from %s", async (_name, result) => {
    const error = await rejection(assertUrlSafeFast(url, { preChecks: mock(async () => result) }));

    expect(error?.code).toBe("BAD_REQUEST");
    expect(error?.message).toBe(result.userMessage);
  });
});

describe("canDeferLlmCheck", () => {
  const NOW = new Date("2026-11-26T12:00:00Z");
  const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
  const account = (overrides: Partial<SafetyAccount>): SafetyAccount => ({
    plan: "free",
    isTeam: false,
    createdAt: async () => daysAgo(30),
    ...overrides,
  });

  test("defers for paying and team accounts without looking up their age", async () => {
    const createdAt = mock(async () => daysAgo(0));
    expect(await canDeferLlmCheck(account({ plan: "pro", createdAt }), NOW)).toBe(true);
    expect(await canDeferLlmCheck(account({ plan: "ultra", createdAt }), NOW)).toBe(true);
    expect(await canDeferLlmCheck(account({ isTeam: true, createdAt }), NOW)).toBe(true);
    expect(createdAt).not.toHaveBeenCalled();
  });

  test("defers for free accounts from 7 days old", async () => {
    expect(await canDeferLlmCheck(account({ createdAt: async () => daysAgo(7) }), NOW)).toBe(true);
    expect(await canDeferLlmCheck(account({ createdAt: async () => daysAgo(400) }), NOW)).toBe(
      true,
    );
  });

  test("keeps the full check for free accounts younger than 7 days or of unknown age", async () => {
    expect(await canDeferLlmCheck(account({ createdAt: async () => daysAgo(6.9) }), NOW)).toBe(
      false,
    );
    expect(await canDeferLlmCheck(account({ createdAt: async () => null }), NOW)).toBe(false);
  });
});

describe("lookalike bank and payment hosts", () => {
  const url = "https://lnternationalcard.servicesportal.im/login";
  const account = (overrides: Partial<SafetyAccount>): SafetyAccount => ({
    plan: "free",
    isTeam: false,
    createdAt: async () => null,
    ...overrides,
  });

  test("assertUrlSafe rejects one from a free account", async () => {
    const deps = fakeDeps();
    const error = await rejection(assertUrlSafe(url, { ...deps, account: account({}) }));

    expect(error?.code).toBe("BAD_REQUEST");
    expect(deps.detect).not.toHaveBeenCalled();
  });

  test("assertUrlSafe flags one from a paying or team account for review", async () => {
    for (const overrides of [{ plan: "pro" as const }, { isTeam: true }]) {
      const result = await assertUrlSafe(url, { ...fakeDeps(), account: account(overrides) });
      expect(result.followUp).toMatchObject({ kind: "review", reason: LOOKALIKE_HOST_REASON });
    }
  });

  test("assertUrlSafe still rejects a paying account's lookalike the LLM flags", async () => {
    const deps = fakeDeps({ detect: mock(async (u: string) => ({ url: u, phishing: true })) });
    const error = await rejection(
      assertUrlSafe(url, { ...deps, account: account({ plan: "pro" }) }),
    );
    expect(error?.message).toBe(USER_MSG_UNSAFE);
  });

  test("checkUrlWithLlm blocks free accounts and flags paying ones without fetching", async () => {
    const deps = fakeDeps();
    const free = await checkUrlWithLlm(url, { ...deps, account: account({}) });
    const paying = await checkUrlWithLlm(url, { ...deps, account: account({ plan: "ultra" }) });

    expect(free).toMatchObject({ kind: "block", reason: LOOKALIKE_HOST_REASON });
    expect(paying).toMatchObject({ kind: "review", reason: LOOKALIKE_HOST_REASON });
    expect(deps.scrape).not.toHaveBeenCalled();
    expect(deps.detect).not.toHaveBeenCalled();
  });

  test("leaves the official domain alone", async () => {
    const result = await assertUrlSafe("https://www.icscards.nl/", {
      ...fakeDeps(),
      account: account({}),
    });
    expect(result).toEqual({ outcome: "allowed", followUp: undefined });
  });
});
