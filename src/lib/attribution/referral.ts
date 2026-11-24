import { APP_BASE_DOMAIN } from "@/lib/constants/domains";

// UTM-tagged links back to the marketing site, so visits from iShortn's own
// surfaces show up in first-touch attribution instead of as direct traffic.

/** Footer link on a public bio page; `utm_content` names the page it came from. */
export function getBioReferralUrl(slug: string): string {
  const params = new URLSearchParams({
    utm_source: "bio_page",
    utm_medium: "referral",
    utm_campaign: "made_with_ishortn",
    utm_content: slug,
  });
  return `https://${APP_BASE_DOMAIN}/?${params.toString()}`;
}

/** Footer credit on a shared, read-only link analytics page (/stats/<token>). */
export function getSharedStatsReferralUrl(): string {
  const params = new URLSearchParams({
    utm_source: "shared_stats",
    utm_medium: "referral",
    utm_campaign: "made_with_ishortn",
  });
  return `https://${APP_BASE_DOMAIN}/?${params.toString()}`;
}

/** Tags a marketing-site URL or path linked from inside the product. */
export function withProductUtm(url: string, medium: "email" | "app", campaign: string): string {
  const params = new URLSearchParams({
    utm_source: "product",
    utm_medium: medium,
    utm_campaign: campaign,
  });
  return `${url}${url.includes("?") ? "&" : "?"}${params.toString()}`;
}
