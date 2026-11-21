export const ISHORTN_URL = "https://ishortn.ink";
export const API_BASE_URL = `${ISHORTN_URL}/api/v1`;

/** An ishortn.ink page with the extension's UTM parameters, so visits from Raycast are attributed. */
export function ishortnPageUrl(path: string, params: Record<string, string> = {}, hash = ""): string {
  const url = new URL(path, ISHORTN_URL);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  url.searchParams.set("utm_source", "raycast");
  url.searchParams.set("utm_medium", "integration");
  url.searchParams.set("utm_campaign", "raycast_extension");
  url.hash = hash;
  return url.toString();
}

export const PRICING_URL = ishortnPageUrl("/pricing");
export const API_KEYS_URL = ishortnPageUrl("/dashboard/settings", {}, "api-keys");

/** The link's analytics page in the dashboard; without a domain it opens the account's default domain. */
export function dashboardAnalyticsUrl(alias: string, domain?: string): string {
  return ishortnPageUrl(`/dashboard/analytics/${encodeURIComponent(alias)}`, domain ? { domain } : {});
}
