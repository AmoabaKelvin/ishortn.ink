import { z } from "zod";

import { env } from "@/env.mjs";
import { logger } from "@/lib/logger";

const log = logger.child({ component: "phishing.safe-browsing" });

/** Lookup API v4 accepts at most 500 threatEntries per threatMatches:find request. */
export const SAFE_BROWSING_BATCH_SIZE = 500;

const threatMatchesSchema = z.object({
  matches: z
    .array(z.object({ threatType: z.string(), threat: z.object({ url: z.string() }) }))
    .optional(),
});

export type SafeBrowsingResult =
  | { status: "safe" }
  | { status: "unsafe"; threats: string[] }
  | { status: "error" };

export type SafeBrowsingBatchResult =
  | { status: "ok"; threatsByUrl: Map<string, string[]> }
  | { status: "error" };

export async function checkGoogleSafeBrowsing(url: string): Promise<SafeBrowsingResult> {
  const result = await checkGoogleSafeBrowsingBatch([url]);
  if (result.status === "error") return result;

  const threats = [...result.threatsByUrl.values()].flat();
  return threats.length > 0 ? { status: "unsafe", threats } : { status: "safe" };
}

/** Checks up to SAFE_BROWSING_BATCH_SIZE URLs in one request; matches are keyed by the submitted URL. */
export async function checkGoogleSafeBrowsingBatch(
  urls: string[],
): Promise<SafeBrowsingBatchResult> {
  const apiKey = env.GOOGLE_SAFE_BROWSING_API_KEY;

  if (!apiKey || urls.length === 0 || urls.length > SAFE_BROWSING_BATCH_SIZE) {
    return { status: "error" };
  }

  try {
    const response = await fetch(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client: {
            clientId: "ishortn-ink",
            clientVersion: "1.0.0",
          },
          threatInfo: {
            threatTypes: [
              "MALWARE",
              "SOCIAL_ENGINEERING",
              "UNWANTED_SOFTWARE",
              "POTENTIALLY_HARMFUL_APPLICATION",
            ],
            platformTypes: ["ANY_PLATFORM"],
            threatEntryTypes: ["URL"],
            threatEntries: urls.map((url) => ({ url })),
          },
        }),
        signal: AbortSignal.timeout(urls.length > 1 ? 15_000 : 5000),
      },
    );

    if (!response.ok) {
      log.error(
        { status: response.status, statusText: response.statusText },
        "Safe Browsing API returned non-ok status",
      );
      return { status: "error" };
    }

    const data = threatMatchesSchema.parse(await response.json());

    const threatsByUrl = new Map<string, string[]>();
    for (const match of data.matches ?? []) {
      const threats = threatsByUrl.get(match.threat.url) ?? [];
      threats.push(match.threatType);
      threatsByUrl.set(match.threat.url, threats);
    }

    return { status: "ok", threatsByUrl };
  } catch (error) {
    log.error({ err: error }, "Safe Browsing check failed");
    return { status: "error" };
  }
}
