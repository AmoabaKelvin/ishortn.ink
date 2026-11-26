import { TRPCError } from "@trpc/server";

import { logger } from "@/lib/logger";
import { runBackgroundTask } from "@/lib/utils/background";
import { INVALID_URL_MESSAGE } from "@/lib/utils/destination-url";
import { detectPhishingLink } from "@/server/api/routers/ai/ai.service";
import { scrapeMetadata } from "@/server/lib/metadata";

import { checkBlocklist } from "./blocklist";
import { checkGoogleSafeBrowsing } from "./google-safe-browsing";
import { INVALID_URL_REASON, runHeuristicChecks } from "./heuristics";
import { hasSafeVerdict, storeSafeVerdict } from "./verdict-cache";
import { checkGoogleWebRisk } from "./web-risk";
import { isWellKnownHost } from "./well-known-hosts";

import type { ScrapedMetadata } from "@/server/lib/metadata";
import type { ServerTiming } from "@/server/lib/server-timing";

const log = logger.child({ component: "phishing" });

/** Milliseconds spent in each safety step, logged so regressions show up. */
type SafetyTimings = Partial<
  Record<"deterministicMs" | "safeBrowsingMs" | "verdictCacheMs" | "scrapeMs" | "llmMs", number>
>;

/** Server-Timing metric name for each safety step. */
const SERVER_TIMING_STEPS: ReadonlyArray<readonly [keyof SafetyTimings, string]> = [
  ["deterministicMs", "deterministic"],
  ["safeBrowsingMs", "safebrowsing"],
  ["verdictCacheMs", "verdictcache"],
  ["scrapeMs", "scrape"],
  ["llmMs", "llm"],
];

type CheckResult = {
  blocked: boolean;
  /** Internal/admin-facing reason with technical details */
  reason: string;
  /** User-facing message — safe to show in toasts/UI */
  userMessage: string;
};

export const USER_MSG_UNSAFE =
  "This URL has been flagged as potentially unsafe and cannot be shortened. If you believe this is a mistake, please contact support.";

const USER_MSG_BLOCKLISTED =
  "This URL belongs to a domain that has been blocked. If you believe this is a mistake, please contact support.";

const USER_MSG_SUSPICIOUS =
  "This URL looks suspicious and cannot be shortened. Please double-check the URL and try again, or contact support if you believe this is an error.";

/**
 * Runs all deterministic checks (heuristics + blocklist).
 * These are fast and don't call external APIs.
 */
export async function runDeterministicChecks(url: string): Promise<CheckResult> {
  // Layer 1a: Heuristic pattern checks (synchronous, instant)
  const heuristicResult = runHeuristicChecks(url);
  if (heuristicResult.blocked) {
    // An unparseable URL is a typo, not a phishing signal.
    return {
      ...heuristicResult,
      userMessage:
        heuristicResult.reason === INVALID_URL_REASON ? INVALID_URL_MESSAGE : USER_MSG_SUSPICIOUS,
    };
  }

  // Layer 1b: Database blocklist check
  const blocklistResult = await checkBlocklist(url);
  if (blocklistResult.blocked) {
    return {
      ...blocklistResult,
      userMessage: USER_MSG_BLOCKLISTED,
    };
  }

  return { blocked: false, reason: "", userMessage: "" };
}

/**
 * Runs all pre-LLM checks: deterministic + Google Safe Browsing + Web Risk (fallback).
 * Call this before the existing LLM-based phishing detection.
 */
export async function runPreLLMChecks(
  url: string,
  timings: SafetyTimings = {},
): Promise<CheckResult> {
  // Layer 1: Deterministic checks
  let started = Date.now();
  const deterministicResult = await runDeterministicChecks(url);
  timings.deterministicMs = Date.now() - started;
  if (deterministicResult.blocked) {
    return deterministicResult;
  }

  // Layer 2: Google Safe Browsing API
  started = Date.now();
  const safeBrowsingResult = await checkGoogleSafeBrowsing(url);
  timings.safeBrowsingMs = Date.now() - started;

  if (safeBrowsingResult.status === "unsafe") {
    return {
      blocked: true,
      reason: `Google Safe Browsing flagged this URL: ${safeBrowsingResult.threats.join(", ")}`,
      userMessage: USER_MSG_UNSAFE,
    };
  }

  // Layer 2b: Google Web Risk API (fallback when Safe Browsing is unavailable or errors)
  if (safeBrowsingResult.status === "error") {
    const webRiskResult = await checkGoogleWebRisk(url);
    timings.safeBrowsingMs = Date.now() - started;

    if (webRiskResult.status === "unsafe") {
      return {
        blocked: true,
        reason: `Google Web Risk flagged this URL: ${webRiskResult.threats.join(", ")}`,
        userMessage: USER_MSG_UNSAFE,
      };
    }

    // Both failed — fail open, let the LLM check handle it
    if (webRiskResult.status === "error") {
      log.warn({ url }, "both Safe Browsing and Web Risk failed");
    }
  }

  return { blocked: false, reason: "", userMessage: "" };
}

/** What the LLM step needs, prepared while the pre-LLM checks run. Never rejects. */
type LLMInput =
  | { kind: "well-known" }
  | { kind: "cached" }
  | { kind: "heuristic-block" }
  | { kind: "scraped"; metadata: ScrapedMetadata }
  | { kind: "scrape-failed"; error: unknown };

export type UrlSafetyDeps = {
  preChecks?: typeof runPreLLMChecks;
  scrape?: (url: string) => Promise<ScrapedMetadata>;
  detect?: typeof detectPhishingLink;
  readVerdict?: (url: string) => Promise<boolean>;
  /** Remembers a "not phishing" verdict; must not delay the response. */
  rememberVerdict?: (url: string) => void;
};

async function prepareLLMInput(
  url: string,
  scrape: (url: string) => Promise<ScrapedMetadata>,
  readVerdict: (url: string) => Promise<boolean>,
  timings: SafetyTimings,
): Promise<LLMInput> {
  if (isWellKnownHost(url)) return { kind: "well-known" };
  // The pre-LLM checks will reject this URL; don't fetch it in the meantime.
  if (runHeuristicChecks(url).blocked) return { kind: "heuristic-block" };

  let started = Date.now();
  const cached = await readVerdict(url).catch(() => false);
  timings.verdictCacheMs = Date.now() - started;
  if (cached) return { kind: "cached" };

  started = Date.now();
  try {
    return { kind: "scraped", metadata: await scrape(url) };
  } catch (error) {
    return { kind: "scrape-failed", error };
  } finally {
    timings.scrapeMs = Date.now() - started;
  }
}

/**
 * Run the full URL safety pipeline (pre-LLM checks + LLM phishing detection)
 * and throw if the URL is unsafe. Call this from every link write path.
 *
 * The pre-LLM checks always run. The scrape and LLM call are skipped for well-known hosts and
 * for URLs the LLM cleared in the last 24 h; the blocklist and Safe Browsing still cover those.
 * `serverTiming` receives `safety` (with the outcome) and the durations of the steps that finished.
 */
export async function assertUrlSafe(
  url: string,
  deps: UrlSafetyDeps = {},
  serverTiming?: ServerTiming,
): Promise<void> {
  const {
    preChecks = runPreLLMChecks,
    scrape = scrapeMetadata,
    detect = detectPhishingLink,
    readVerdict = hasSafeVerdict,
    rememberVerdict = (safeUrl) => void runBackgroundTask(storeSafeVerdict(safeUrl)),
  } = deps;
  const started = Date.now();
  const timings: SafetyTimings = {};
  const done = (outcome: string) => {
    const totalMs = Date.now() - started;
    log.info({ url, outcome, totalMs, ...timings }, "url safety checked");
    if (!serverTiming) return;
    serverTiming.add("safety", totalMs, outcome);
    for (const [key, name] of SERVER_TIMING_STEPS) {
      const ms = timings[key];
      if (ms !== undefined) serverTiming.add(name, ms);
    }
  };

  // The page fetch doesn't depend on the pre-LLM checks, so it runs alongside them. Its result
  // is discarded if they block the URL.
  const llmInput = prepareLLMInput(url, scrape, readVerdict, timings);

  // Layer 1 & 2: Deterministic checks + Google Safe Browsing / Web Risk
  const preLLMResult = await preChecks(url, timings);
  if (preLLMResult.blocked) {
    log.warn({ url, reason: preLLMResult.reason }, "link blocked (pre-LLM)");
    done("blocked-pre-llm");
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: preLLMResult.userMessage,
    });
  }

  const input = await llmInput;
  // Only reachable if the pre-LLM checks skipped the heuristics; never let such a URL through.
  if (input.kind === "heuristic-block") {
    done("blocked-heuristics");
    throw new TRPCError({ code: "BAD_REQUEST", message: USER_MSG_SUSPICIOUS });
  }
  if (input.kind === "well-known" || input.kind === "cached") {
    done(input.kind);
    return;
  }

  // Layer 3: LLM-based phishing detection. Fail open — an outage in the
  // metadata service or the LLM provider must not block link creation.
  if (input.kind === "scrape-failed") {
    log.warn({ err: input.error, url }, "LLM phishing check failed, allowing link");
    done("scrape-failed");
    return;
  }

  const llmStarted = Date.now();
  let phishingResult: { url: string; phishing: boolean };
  try {
    phishingResult = await detect(url, input.metadata);
  } catch (error) {
    timings.llmMs = Date.now() - llmStarted;
    log.warn({ err: error, url }, "LLM phishing check failed, allowing link");
    done("llm-failed");
    return;
  }
  timings.llmMs = Date.now() - llmStarted;

  if (phishingResult.phishing) {
    done("blocked-llm");
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: USER_MSG_UNSAFE,
    });
  }

  // Only a completed "not phishing" verdict is cached; failures and timeouts above return early.
  rememberVerdict(url);
  done("allowed");
}
