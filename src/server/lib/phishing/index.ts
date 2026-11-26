import { TRPCError } from "@trpc/server";

import { logger } from "@/lib/logger";
import { runBackgroundTask } from "@/lib/utils/background";
import { INVALID_URL_MESSAGE } from "@/lib/utils/destination-url";
import { detectPhishingLink } from "@/server/api/routers/ai/ai.service";
import { scrapePageForSafetyCheck } from "@/server/lib/metadata";

import { checkBlocklist } from "./blocklist";
import { checkGoogleSafeBrowsing } from "./google-safe-browsing";
import { INVALID_URL_REASON, runHeuristicChecks } from "./heuristics";
import { isSharedHostTenant } from "./shared-hosts";
import { hasSafeVerdict, storeSafeVerdict } from "./verdict-cache";
import { checkGoogleWebRisk } from "./web-risk";
import { isWellKnownHost } from "./well-known-hosts";

import type { Plan } from "@/lib/billing/plans";
import type { PageSignals, ScrapedPage } from "@/server/lib/metadata";

const log = logger.child({ component: "phishing" });

/** Milliseconds spent in each safety step, logged so regressions show up. */
type SafetyTimings = Partial<
  Record<"deterministicMs" | "safeBrowsingMs" | "verdictCacheMs" | "scrapeMs" | "llmMs", number>
>;

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
  | { kind: "scraped"; page: ScrapedPage }
  | { kind: "scrape-failed"; error: unknown };

/** The account a link is created for; the credential-form rule treats new free accounts strictly. */
export type SafetyAccount = {
  plan: Plan;
  isTeam: boolean;
  /** Loaded only when a rule needs the account's age. */
  createdAt: () => Promise<Date | null>;
};

/** Work the caller records against the link once it exists (see `recordSafetyFollowUp`). */
export type SafetyFollowUp =
  | { kind: "review"; reason: string; details: string }
  | { kind: "recheck"; reason: "unverified-challenge" | "scrape-failed" };

export type UrlSafetyResult = { outcome: string; followUp?: SafetyFollowUp };

export type UrlSafetyDeps = {
  preChecks?: typeof runPreLLMChecks;
  scrape?: (url: string) => Promise<ScrapedPage>;
  detect?: typeof detectPhishingLink;
  readVerdict?: (url: string) => Promise<boolean>;
  /** Remembers a "not phishing" verdict; must not delay the response. */
  rememberVerdict?: (url: string) => void;
  now?: () => Date;
};

export type UrlSafetyOptions = UrlSafetyDeps & { account?: SafetyAccount };

const NEW_ACCOUNT_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;
export const CREDENTIAL_FORM_REASON = "phishing-check:credential-form";

async function prepareLLMInput(
  url: string,
  scrape: (url: string) => Promise<ScrapedPage>,
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
    return { kind: "scraped", page: await scrape(url) };
  } catch (error) {
    return { kind: "scrape-failed", error };
  } finally {
    timings.scrapeMs = Date.now() - started;
  }
}

/**
 * A sign-in form (password plus email or username) on a tenant subdomain of a page builder or
 * free host. A password field alone is also how WordPress.com protected posts and password-locked
 * file shares ask for their password, so it isn't enough.
 */
function credentialFormHost(signals: PageSignals): string | null {
  if (!signals.hasPasswordInput || !signals.hasEmailInput) return null;
  let host: string;
  try {
    host = new URL(signals.finalUrl).hostname;
  } catch {
    return null;
  }
  return isSharedHostTenant(host) ? host : null;
}

/** New free accounts are rejected outright; anyone else (or an unknown account) is reviewed. */
async function isNewFreeAccount(account: SafetyAccount | undefined, now: Date): Promise<boolean> {
  if (!account || account.isTeam || account.plan !== "free") return false;
  const createdAt = await account.createdAt();
  return createdAt !== null && now.getTime() - createdAt.getTime() < NEW_ACCOUNT_DAYS * DAY_MS;
}

/**
 * Run the full URL safety pipeline (pre-LLM checks, page rules and LLM phishing detection) and
 * throw if the URL is unsafe. Call this from every link write path, passing the account, and hand
 * the result to `recordSafetyFollowUp` once the link exists.
 *
 * The pre-LLM checks always run. The scrape and LLM call are skipped for well-known hosts and
 * for URLs the LLM cleared in the last 24 h; the blocklist and Safe Browsing still cover those.
 */
export async function assertUrlSafe(
  url: string,
  options: UrlSafetyOptions = {},
): Promise<UrlSafetyResult> {
  const {
    preChecks = runPreLLMChecks,
    scrape = scrapePageForSafetyCheck,
    detect = detectPhishingLink,
    readVerdict = hasSafeVerdict,
    rememberVerdict = (safeUrl) => void runBackgroundTask(storeSafeVerdict(safeUrl)),
    now = () => new Date(),
    account,
  } = options;
  const started = Date.now();
  const timings: SafetyTimings = {};
  const done = (outcome: string, followUp?: SafetyFollowUp): UrlSafetyResult => {
    log.info({ url, outcome, totalMs: Date.now() - started, ...timings }, "url safety checked");
    return { outcome, followUp };
  };
  const reject = (outcome: string, message: string): never => {
    done(outcome);
    throw new TRPCError({ code: "BAD_REQUEST", message });
  };

  // The page fetch doesn't depend on the pre-LLM checks, so it runs alongside them. Its result
  // is discarded if they block the URL.
  const llmInput = prepareLLMInput(url, scrape, readVerdict, timings);

  // Layer 1 & 2: Deterministic checks + Google Safe Browsing / Web Risk
  const preLLMResult = await preChecks(url, timings);
  if (preLLMResult.blocked) {
    log.warn({ url, reason: preLLMResult.reason }, "link blocked (pre-LLM)");
    return reject("blocked-pre-llm", preLLMResult.userMessage);
  }

  const input = await llmInput;
  // Only reachable if the pre-LLM checks skipped the heuristics; never let such a URL through.
  if (input.kind === "heuristic-block") return reject("blocked-heuristics", USER_MSG_SUSPICIOUS);
  if (input.kind === "well-known" || input.kind === "cached") return done(input.kind);

  // Layer 3: LLM-based phishing detection. Fail open — an outage in the
  // metadata service or the LLM provider must not block link creation.
  if (input.kind === "scrape-failed") {
    log.warn({ err: input.error, url }, "LLM phishing check failed, allowing link");
    return done("scrape-failed", { kind: "recheck", reason: "scrape-failed" });
  }

  const { metadata, signals } = input.page;
  // A challenge or error page says nothing about the real page, so no verdict on it is cached.
  const unverified = signals.isChallenge || signals.status < 200 || signals.status >= 300;

  // Layer 3a: credential form on a page builder or free host (deterministic, before the LLM).
  let followUp: SafetyFollowUp | undefined;
  const formHost = credentialFormHost(signals);
  if (formHost) {
    if (await isNewFreeAccount(account, now())) {
      log.warn({ url, host: formHost }, "link blocked (credential form on shared host)");
      return reject("blocked-credential-form", USER_MSG_SUSPICIOUS);
    }
    followUp = {
      kind: "review",
      reason: CREDENTIAL_FORM_REASON,
      details: `Password form on shared host ${formHost} (allowed for a paying, team or established account, review before blocking)`,
    };
  } else if (unverified) {
    followUp = { kind: "recheck", reason: "unverified-challenge" };
  }

  const llmStarted = Date.now();
  let phishingResult: { url: string; phishing: boolean };
  try {
    phishingResult = await detect(url, metadata, signals);
  } catch (error) {
    timings.llmMs = Date.now() - llmStarted;
    log.warn({ err: error, url }, "LLM phishing check failed, allowing link");
    return done("llm-failed", followUp);
  }
  timings.llmMs = Date.now() - llmStarted;

  if (phishingResult.phishing) return reject("blocked-llm", USER_MSG_UNSAFE);
  if (formHost) return done("flagged-credential-form", followUp);
  if (unverified) return done("unverified-challenge", followUp);

  // Only a completed "not phishing" verdict on the real page is cached; everything above returns
  // early, so a URL that is flagged or unverified is checked again next time.
  rememberVerdict(url);
  return done("allowed");
}
