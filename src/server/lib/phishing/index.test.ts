import { describe, expect, mock, test } from "bun:test";

import { TRPCError } from "@trpc/server";

import { ServerTiming } from "@/server/lib/server-timing";

import {
  USER_MSG_UNSAFE,
  assertUrlSafe,
  assertUrlSafeFast,
  checkUrlWithLlm,
  runPreLLMChecks,
} from "./index";

import type { LlmCheckDeps, PreLLMCheckDeps, UrlSafetyDeps } from "./index";

const METADATA = { title: "Example", description: "", image: "", favicon: "" };
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
    scrape: mock(async (_url: string) => METADATA),
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
        return METADATA;
      }),
      // Resolves only once the scrape has started, so this would hang if the steps were serial.
      preChecks: mock(async () => {
        await scrapeStartedPromise;
        return PASS;
      }),
    });

    await assertUrlSafe(url, deps);

    expect(deps.readVerdict).toHaveBeenCalledWith(url);
    expect(deps.detect).toHaveBeenCalledWith(url, METADATA);
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

describe("assertUrlSafeFast", () => {
  test.each([
    ["the blocklist", BLOCKLISTED],
    ["Safe Browsing", SAFE_BROWSING_FLAGGED],
  ])("rejects with %s's message", async (_name, result) => {
    const error = await rejection(
      assertUrlSafeFast(
        "https://example.com/landing",
        mock(async () => result),
      ),
    );

    expect(error?.message).toBe(result.userMessage);
  });

  test("rejects what the heuristics flag without any network call", async () => {
    const error = await rejection(assertUrlSafeFast("http://192.168.10.20/login"));

    expect(error?.code).toBe("BAD_REQUEST");
  });

  test("passes when the pre-LLM checks do", async () => {
    await assertUrlSafeFast(
      "https://example.com/landing",
      mock(async () => PASS),
    );
  });
});

describe("checkUrlWithLlm", () => {
  const url = "https://example.com/landing";
  const linkId = 42;

  function llmDeps(overrides: LlmCheckDeps = {}) {
    const { preChecks: _, ...deps } = fakeDeps();
    return { ...deps, onPhishing: mock(async (_linkId: number, _url: string) => {}), ...overrides };
  }

  test("hands a phishing verdict to onPhishing and does not cache it", async () => {
    const deps = llmDeps({ detect: mock(async () => ({ url, phishing: true })) });

    expect(await checkUrlWithLlm(linkId, url, deps)).toBe("phishing");
    expect(deps.onPhishing).toHaveBeenCalledWith(linkId, url);
    expect(deps.rememberVerdict).not.toHaveBeenCalled();
  });

  test("caches a safe verdict and leaves the link alone", async () => {
    const deps = llmDeps();

    expect(await checkUrlWithLlm(linkId, url, deps)).toBe("allowed");
    expect(deps.detect).toHaveBeenCalledWith(url, METADATA);
    expect(deps.rememberVerdict).toHaveBeenCalledWith(url);
    expect(deps.onPhishing).not.toHaveBeenCalled();
  });

  test("skips the scrape and the LLM for a cached verdict", async () => {
    const deps = llmDeps({ readVerdict: mock(async () => true) });

    expect(await checkUrlWithLlm(linkId, url, deps)).toBe("cached");
    expect(deps.scrape).not.toHaveBeenCalled();
    expect(deps.detect).not.toHaveBeenCalled();
  });

  test("skips everything for a well-known host", async () => {
    const deps = llmDeps();

    expect(await checkUrlWithLlm(linkId, "https://github.com/AmoabaKelvin", deps)).toBe(
      "well-known",
    );
    expect(deps.readVerdict).not.toHaveBeenCalled();
    expect(deps.scrape).not.toHaveBeenCalled();
  });

  test("fails open when the scrape fails", async () => {
    const deps = llmDeps({
      scrape: mock(async () => {
        throw new Error("fetch failed");
      }),
    });

    expect(await checkUrlWithLlm(linkId, url, deps)).toBe("scrape-failed");
    expect(deps.detect).not.toHaveBeenCalled();
    expect(deps.onPhishing).not.toHaveBeenCalled();
  });

  test("fails open when the LLM fails", async () => {
    const deps = llmDeps({
      detect: mock(async () => {
        throw new Error("timeout");
      }),
    });

    expect(await checkUrlWithLlm(linkId, url, deps)).toBe("llm-failed");
    expect(deps.onPhishing).not.toHaveBeenCalled();
    expect(deps.rememberVerdict).not.toHaveBeenCalled();
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

describe("assertUrlSafeFast Server-Timing", () => {
  test("reports the pre-LLM steps and no scrape or llm", async () => {
    const timing = new ServerTiming();
    const preChecks = mock(async (_url: string, timings = {}) => {
      timings.deterministicMs = 3;
      timings.safeBrowsingMs = 5;
      return PASS;
    });
    await assertUrlSafeFast("https://example.com/landing", preChecks, timing);

    expect(timing.header()).toMatch(
      /^safety;dur=\d+;desc="passed-pre-llm", deterministic;dur=3, safebrowsing;dur=5, total;dur=\d+$/,
    );
  });
});
