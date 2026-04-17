import { env } from "@/env.mjs";
import { logger } from "@/lib/logger";

const log = logger.child({ component: "phishing.web-risk" });

type WebRiskResult =
  | { status: "safe" }
  | { status: "unsafe"; threats: string[] }
  | { status: "error" };

export async function checkGoogleWebRisk(url: string): Promise<WebRiskResult> {
  // Web Risk uses the same GCP API key as Safe Browsing (requires billing enabled)
  const apiKey = env.GOOGLE_SAFE_BROWSING_API_KEY;

  if (!apiKey) {
    return { status: "error" };
  }

  try {
    const params = new URLSearchParams({
      uri: url,
      key: apiKey,
    });

    // Web Risk supports these threat types
    for (const threatType of [
      "MALWARE",
      "SOCIAL_ENGINEERING",
      "UNWANTED_SOFTWARE",
    ]) {
      params.append("threatTypes", threatType);
    }

    const response = await fetch(
      `https://webrisk.googleapis.com/v1/uris:search?${params.toString()}`,
      { signal: AbortSignal.timeout(5000) },
    );

    if (!response.ok) {
      log.error(
        { status: response.status, statusText: response.statusText },
        "Web Risk API returned non-ok status",
      );
      return { status: "error" };
    }

    const data = (await response.json()) as {
      threat?: { threatTypes: string[]; expireTime: string };
    };

    if (data.threat) {
      return {
        status: "unsafe",
        threats: data.threat.threatTypes,
      };
    }

    return { status: "safe" };
  } catch (error) {
    log.error({ err: error }, "Web Risk check failed");
    return { status: "error" };
  }
}
