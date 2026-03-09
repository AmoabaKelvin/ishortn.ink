import { detectPhishingLink } from "@/server/api/routers/ai/ai.service";
import { fetchMetadataInfo } from "@/lib/utils/fetch-link-metadata";

import { checkBlocklist } from "./blocklist";
import { checkGoogleSafeBrowsing } from "./google-safe-browsing";
import { runHeuristicChecks } from "./heuristics";
import { checkGoogleWebRisk } from "./web-risk";

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
export async function runDeterministicChecks(
  url: string,
): Promise<CheckResult> {
  // Layer 1a: Heuristic pattern checks (synchronous, instant)
  const heuristicResult = runHeuristicChecks(url);
  if (heuristicResult.blocked) {
    return {
      ...heuristicResult,
      userMessage: USER_MSG_SUSPICIOUS,
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
export async function runPreLLMChecks(url: string): Promise<CheckResult> {
  // Layer 1: Deterministic checks
  const deterministicResult = await runDeterministicChecks(url);
  if (deterministicResult.blocked) {
    return deterministicResult;
  }

  // Layer 2: Google Safe Browsing API
  const safeBrowsingResult = await checkGoogleSafeBrowsing(url);

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

    if (webRiskResult.status === "unsafe") {
      return {
        blocked: true,
        reason: `Google Web Risk flagged this URL: ${webRiskResult.threats.join(", ")}`,
        userMessage: USER_MSG_UNSAFE,
      };
    }

    // Both failed — fail open, let the LLM check handle it
    if (webRiskResult.status === "error") {
      console.warn(
        "Both Google Safe Browsing and Web Risk failed for URL:",
        url,
      );
    }
  }

  return { blocked: false, reason: "", userMessage: "" };
}

/**
 * Run the full URL safety pipeline (pre-LLM checks + LLM phishing detection)
 * and throw if the URL is unsafe. Call this from every link write path.
 */
export async function assertUrlSafe(url: string): Promise<void> {
  // Layer 1 & 2: Deterministic checks + Google Safe Browsing / Web Risk
  const preLLMResult = await runPreLLMChecks(url);
  if (preLLMResult.blocked) {
    console.warn(`Link blocked (pre-LLM): ${preLLMResult.reason}`);
    throw new Error(preLLMResult.userMessage);
  }

  // Layer 3: LLM-based phishing detection
  const fetchedMetadata = await fetchMetadataInfo(url);
  const phishingResult = await detectPhishingLink(url, fetchedMetadata);

  if (phishingResult.phishing) {
    throw new Error(USER_MSG_UNSAFE);
  }
}
