import { env } from "@/env.mjs";

export type SafeBrowsingResult =
  | { status: "safe" }
  | { status: "unsafe"; threats: string[] }
  | { status: "error" };

export async function checkGoogleSafeBrowsing(
  url: string,
): Promise<SafeBrowsingResult> {
  const apiKey = env.GOOGLE_SAFE_BROWSING_API_KEY;

  if (!apiKey) {
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
            threatEntries: [{ url }],
          },
        }),
        signal: AbortSignal.timeout(5000),
      },
    );

    if (!response.ok) {
      console.error(
        `Google Safe Browsing API error: ${response.status} ${response.statusText}`,
      );
      return { status: "error" };
    }

    const data = (await response.json()) as {
      matches?: Array<{ threatType: string }>;
    };

    if (data.matches && data.matches.length > 0) {
      return {
        status: "unsafe",
        threats: data.matches.map((m) => m.threatType),
      };
    }

    return { status: "safe" };
  } catch (error) {
    console.error("Google Safe Browsing check failed:", error);
    return { status: "error" };
  }
}
