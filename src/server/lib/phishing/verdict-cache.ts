import { createHash } from "crypto";

import { getStringFromCache, setStringInCache } from "@/lib/core/cache";

const VERDICT_KEY_PREFIX = "phishing:llm-safe:";
const VERDICT_TTL_SECONDS = 60 * 60 * 24;

/**
 * KV key for a URL's cached "not phishing" LLM verdict. The URL is normalized (lowercase scheme
 * and host, default port and fragment dropped) so trivially different spellings share a verdict;
 * the path and query stay because they select the page that was judged.
 */
export function verdictCacheKey(url: string): string {
  const normalized = new URL(url);
  normalized.hash = "";
  return VERDICT_KEY_PREFIX + createHash("sha256").update(normalized.href).digest("hex");
}

/** Never throws: an unparseable URL or a KV failure reads as a miss. */
export async function hasSafeVerdict(url: string): Promise<boolean> {
  try {
    return (await getStringFromCache(verdictCacheKey(url))) !== null;
  } catch {
    return false;
  }
}

export async function storeSafeVerdict(url: string): Promise<void> {
  await setStringInCache(verdictCacheKey(url), "1", VERDICT_TTL_SECONDS);
}
