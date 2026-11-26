import { TRPCError } from "@trpc/server";

import { logger } from "@/lib/logger";
import { runBackgroundTask } from "@/lib/utils/background";
import { INVALID_URL_MESSAGE } from "@/lib/utils/destination-url";
import { detectPhishingLink } from "@/server/api/routers/ai/ai.service";
import { scrapeMetadata } from "@/server/lib/metadata";

import { checkBlocklist } from "./blocklist";
import { checkGoogleSafeBrowsing } from "./google-safe-browsing";
import { INVALID_URL_REASON, runHeuristicChecks } from "./heuristics";
import { blockOrFlagLlmPhishing } from "./rescan";
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

/** The lookups behind runPreLLMChecks; tests pass fakes. */
export type PreLLMCheckDeps = {
  blocklist?: typeof checkBlocklist;
  safeBrowsing?: typeof checkGoogleSafeBrowsing;
  webRisk?: typeof checkGoogleWebRisk;
};

/**
 * Runs all pre-LLM checks: heuristics, the blocklist, Google Safe Browsing and Web Risk
 * (fallback). Call this before the existing LLM-based phishing detection.
 */
export async function runPreLLMChecks(
  url: string,
  timings: SafetyTimings = {},
  deps: PreLLMCheckDeps = {},
): Promise<CheckResult> {
  const {
    blocklist = checkBlocklist,
    safeBrowsing = checkGoogleSafeBrowsing,
    webRisk = checkGoogleWebRisk,
  } = deps;

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

  // Layer 1b and 2: the blocklist query and the Safe Browsing call are independent, so they run
  // together. Safe Browsing never rejects, so leaving it unawaited on a blocklist hit is safe.
  const started = Date.now();
  const safeBrowsingResultPromise = safeBrowsing(url).then((result) => {
    timings.safeBrowsingMs = Date.now() - started;
    return result;
  });

  // A blocklist hit wins over whatever Safe Browsing says.
  const blocklistResult = await blocklist(url);
  timings.deterministicMs = Date.now() - started;
  if (blocklistResult.blocked) {
    return { ...blocklistResult, userMessage: USER_MSG_BLOCKLISTED };
  }

  const safeBrowsingResult = await safeBrowsingResultPromise;
  if (safeBrowsingResult.status === "unsafe") {
    return {
      blocked: true,
      reason: `Google Safe Browsing flagged this URL: ${safeBrowsingResult.threats.join(", ")}`,
      userMessage: USER_MSG_UNSAFE,
    };
  }

  // Layer 2b: Google Web Risk API (fallback when Safe Browsing is unavailable or errors)
  if (safeBrowsingResult.status === "error") {
    const webRiskResult = await webRisk(url);
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

/** Reports `safety` (with the outcome) and the durations of the steps that finished. */
function addSafetyTimings(
  serverTiming: ServerTiming | undefined,
  outcome: string,
  totalMs: number,
  timings: SafetyTimings,
): void {
  if (!serverTiming) return;
  serverTiming.add("safety", totalMs, outcome);
  for (const [key, name] of SERVER_TIMING_STEPS) {
    const ms = timings[key];
    if (ms !== undefined) serverTiming.add(name, ms);
  }
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

/** How the scrape + LLM step ended. */
type LLMOutcome = "well-known" | "cached" | "scrape-failed" | "llm-failed" | "phishing" | "allowed";

/** Runs the LLM on prepared input. Fails open: scrape and LLM failures count as not phishing. */
async function runLLMStep(
  url: string,
  input: Exclude<LLMInput, { kind: "heuristic-block" }>,
  detect: typeof detectPhishingLink,
  rememberVerdict: (url: string) => void,
  timings: SafetyTimings,
): Promise<LLMOutcome> {
  if (input.kind === "well-known" || input.kind === "cached") return input.kind;

  // An outage in the metadata service or the LLM provider must not block link creation.
  if (input.kind === "scrape-failed") {
    log.warn({ err: input.error, url }, "LLM phishing check failed, allowing link");
    return "scrape-failed";
  }

  const started = Date.now();
  let phishingResult: { url: string; phishing: boolean };
  try {
    phishingResult = await detect(url, input.metadata);
  } catch (error) {
    log.warn({ err: error, url }, "LLM phishing check failed, allowing link");
    return "llm-failed";
  } finally {
    timings.llmMs = Date.now() - started;
  }
  if (phishingResult.phishing) return "phishing";

  // Only a completed "not phishing" verdict is cached; failures and timeouts above return early.
  rememberVerdict(url);
  return "allowed";
}

function defaultLLMDeps(deps: UrlSafetyDeps) {
  return {
    scrape: deps.scrape ?? scrapeMetadata,
    detect: deps.detect ?? detectPhishingLink,
    readVerdict: deps.readVerdict ?? hasSafeVerdict,
    rememberVerdict:
      deps.rememberVerdict ??
      ((safeUrl: string) => void runBackgroundTask(storeSafeVerdict(safeUrl))),
  };
}

/**
 * Run the full URL safety pipeline (pre-LLM checks + LLM phishing detection)
 * and throw if the URL is unsafe.
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
  const { preChecks = runPreLLMChecks } = deps;
  const { scrape, detect, readVerdict, rememberVerdict } = defaultLLMDeps(deps);
  const started = Date.now();
  const timings: SafetyTimings = {};
  const done = (outcome: string) => {
    const totalMs = Date.now() - started;
    log.info({ url, outcome, totalMs, ...timings }, "url safety checked");
    addSafetyTimings(serverTiming, outcome, totalMs, timings);
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

  // Layer 3: LLM-based phishing detection.
  const outcome = await runLLMStep(url, input, detect, rememberVerdict, timings);
  if (outcome === "phishing") {
    done("blocked-llm");
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: USER_MSG_UNSAFE,
    });
  }
  done(outcome);
}

/**
 * The part of `assertUrlSafe` that runs before a link is written: heuristics, the blocklist and
 * Safe Browsing / Web Risk. Pair it with `checkUrlWithLlmAfterResponse` once the link exists.
 * `serverTiming` gets the same metrics as `assertUrlSafe`, without `scrape` or `llm`.
 */
export async function assertUrlSafeFast(
  url: string,
  preChecks: typeof runPreLLMChecks = runPreLLMChecks,
  serverTiming?: ServerTiming,
): Promise<void> {
  const started = Date.now();
  const timings: SafetyTimings = {};
  const result = await preChecks(url, timings);
  const outcome = result.blocked ? "blocked-pre-llm" : "passed-pre-llm";
  const totalMs = Date.now() - started;
  log.info({ url, part: "fast", outcome, totalMs, ...timings }, "url safety checked");
  addSafetyTimings(serverTiming, outcome, totalMs, timings);
  if (result.blocked) {
    log.warn({ url, reason: result.reason }, "link blocked (pre-LLM)");
    throw new TRPCError({ code: "BAD_REQUEST", message: result.userMessage });
  }
}

export type LlmCheckDeps = Omit<UrlSafetyDeps, "preChecks"> & {
  /** Blocks or flags the link once the LLM calls its destination phishing. */
  onPhishing?: (linkId: number, url: string) => Promise<void>;
};

/**
 * The scrape + LLM part of `assertUrlSafe` for a link that already exists, after
 * `assertUrlSafeFast` passed. A phishing verdict blocks the link on a free account and flags it
 * on a paying or team account (`blockOrFlagLlmPhishing`). Resolves with the outcome; never rejects
 * on scrape or LLM failures.
 */
export async function checkUrlWithLlm(
  linkId: number,
  url: string,
  deps: LlmCheckDeps = {},
): Promise<LLMOutcome | "heuristic-block"> {
  const { scrape, detect, readVerdict, rememberVerdict } = defaultLLMDeps(deps);
  const { onPhishing = blockOrFlagLlmPhishing } = deps;
  const started = Date.now();
  const timings: SafetyTimings = {};

  const input = await prepareLLMInput(url, scrape, readVerdict, timings);
  // assertUrlSafeFast already rejected such a URL, so there is nothing to scrape.
  const outcome =
    input.kind === "heuristic-block"
      ? input.kind
      : await runLLMStep(url, input, detect, rememberVerdict, timings);
  log.info(
    { url, linkId, part: "llm", outcome, totalMs: Date.now() - started, ...timings },
    "url safety checked",
  );
  if (outcome === "phishing") await onPhishing(linkId, url);
  return outcome;
}

/** Runs `checkUrlWithLlm` after the response, so the link write doesn't wait on the LLM. */
export function checkUrlWithLlmAfterResponse(linkId: number, url: string): void {
  // Well-known hosts skip the LLM; checking here avoids scheduling a task that does nothing.
  if (isWellKnownHost(url)) return;
  const task = checkUrlWithLlm(linkId, url).catch((err) => {
    log.error({ err, linkId, url }, "after-response LLM phishing check failed");
  });
  // Off-platform (tests, scripts) there is no waitUntil; the task still runs.
  void runBackgroundTask(task).catch(() => undefined);
}
