// Pure link checks shared by the Next redirect page and the worker's cached
// redirect (cached-redirect.ts). No db, logger or env imports: the worker
// entry loads this outside the Next bundle.
import type { Link } from "@/lib/core/cache";

/** True until the owner's scheduled activation instant has passed. */
export function isLinkScheduled(link: Pick<Link, "activateAt">): boolean {
  return !!link.activateAt && new Date() < link.activateAt;
}

/** True once the link's "disable after" date has passed. */
export function isPastDisableDate(link: Pick<Link, "disableLinkAfterDate">): boolean {
  return !!link.disableLinkAfterDate && new Date() >= link.disableLinkAfterDate;
}

export function appendUtmParams(baseUrl: string, utmParams: Link["utmParams"]): string {
  if (!utmParams) return baseUrl;

  try {
    const url = new URL(baseUrl);
    const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

    for (const key of keys) {
      const value = utmParams[key];
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, value);
      }
    }

    return url.toString();
  } catch {
    return baseUrl;
  }
}
