import { DELETION_CASCADE_REASON } from "@/lib/account-deletion/constants";
import { Paths } from "@/lib/constants/app";
import {
  APP_BASE_DOMAIN,
  extractPlatformSubdomain,
  isPlatformDomain,
} from "@/lib/constants/domains";

export type MarketingCampaign =
  | "not_found"
  | "expired"
  | "blocked"
  | "password"
  | "preview"
  | "verified_redirect";

export const UNSAFE_LINK_MESSAGE = "This link was flagged as unsafe and has been disabled.";
export const INACTIVE_LINK_MESSAGE = "This link is no longer active.";

// Reasons are internal (rescan sources, safety API verdicts, admin notes), so
// visitors only ever see one of two sentences. Owner bans and deletions fall
// through to "no longer active".
const UNSAFE_REASON =
  /phish|malware|abuse|spam|scam|fraud|unsafe|blocklist|safe browsing|web risk|social.engineering/i;

export function getBlockedLinkMessage(reason: string | null): string {
  if (!reason || reason === DELETION_CASCADE_REASON) return INACTIVE_LINK_MESSAGE;
  return UNSAFE_REASON.test(reason) ? UNSAFE_LINK_MESSAGE : INACTIVE_LINK_MESSAGE;
}

// Platform short domains (and their team subdomains) carry iShortn branding;
// a customer's own domain gets a neutral page. Local, staging and preview hosts
// count as platform so the branded page can be checked before deploy.
export function isPlatformHost(rawHost: string | null): boolean {
  if (!rawHost) return true;
  const host = (rawHost.split(":")[0] ?? rawHost).toLowerCase().replace(/\.$/, "");
  return (
    isPlatformDomain(host) ||
    extractPlatformSubdomain(host) !== null ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".workers.dev") ||
    host === process.env.STAGING_DOMAIN
  );
}

export function getSignupUrl(campaign: MarketingCampaign): string {
  return `https://${APP_BASE_DOMAIN}/?utm_source=short_link&utm_medium=referral&utm_campaign=${campaign}`;
}

// The status-page button promises sign-up, so it skips the homepage step.
export function getSignupPageUrl(campaign: MarketingCampaign): string {
  return `https://${APP_BASE_DOMAIN}${Paths.Signup}?utm_source=short_link&utm_medium=referral&utm_campaign=${campaign}`;
}

export const REPORT_ABUSE_URL = `https://${APP_BASE_DOMAIN}/abuse`;
