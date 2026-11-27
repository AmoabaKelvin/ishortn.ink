import { APP_BASE_DOMAIN } from "@/lib/constants/domains";

import type { UpgradePlan } from "@/lib/billing/upgrade";

export type EmailLink = {
  /** Alias on APP_BASE_DOMAIN. Link.alias is varchar(20), so this stays within 20 characters. */
  alias: string;
  /** Destination path on the app; UTM tags live on the link, never in this path. */
  path: string;
  utm: {
    utm_source: "email";
    utm_medium: "lifecycle" | "transactional";
    utm_campaign: string;
    utm_content: string;
  };
};

const lifecycle = (campaign: string) => (content: string, alias: string, path: string) =>
  emailLink("lifecycle", campaign, content, alias, path);
const transactional = (campaign: string) => (content: string, alias: string, path: string) =>
  emailLink("transactional", campaign, content, alias, path);

function emailLink(
  medium: EmailLink["utm"]["utm_medium"],
  campaign: string,
  content: string,
  alias: string,
  path: string,
): EmailLink {
  return {
    alias,
    path,
    utm: { utm_source: "email", utm_medium: medium, utm_campaign: campaign, utm_content: content },
  };
}

const welcome = lifecycle("welcome");
const firstLinkNudge = lifecycle("first_link_nudge");
const weeklySummary = lifecycle("weekly_summary");
const upgradeNudge = lifecycle("upgrade_nudge");
const eventUsage = transactional("event_usage");
const promoPaused = transactional("promo_paused");
const planGrace = transactional("plan_grace");
const domainReminder = transactional("domain_reminder");
const apiAccessSunset = transactional("api_access_sunset");

const pricing = (plan: UpgradePlan, source: string) =>
  `/dashboard/pricing?highlight=${plan}&source=${source}`;

/**
 * Fixed short links for static email calls to action, one per template and button, so clicks are
 * counted and tagged the same way in every email. `scripts/email/seed-email-links.ts` creates them.
 * Links that carry a token or a team subdomain stay direct.
 */
export const EMAIL_LINKS = {
  welcome: {
    createLink: welcome("create_link", "e-welcome-link", "/dashboard/link/new"),
    qrCodes: welcome("docs_qr_codes", "e-welcome-qr", "/docs/qr-codes"),
    customDomains: welcome("docs_custom_domains", "e-welcome-domains", "/docs/custom-domains"),
    bioPages: welcome("docs_bio_pages", "e-welcome-bio", "/docs/bio-pages"),
  },
  firstLinkNudge: {
    createLink: firstLinkNudge("create_link", "e-nudge-link", "/dashboard/link/new"),
    createQrCode: firstLinkNudge("create_qr_code", "e-nudge-qr", "/dashboard/qrcodes/create"),
  },
  weeklySummary: {
    analytics: weeklySummary("analytics", "e-weekly-analytics", "/dashboard/analytics/overview"),
    upgrade: {
      paused: weeklySummary("upgrade_paused", "e-weekly-paused", pricing("pro", "weekly_summary")),
      cap: weeklySummary("upgrade_cap", "e-weekly-cap", pricing("pro", "weekly_summary_cap")),
      history: weeklySummary(
        "upgrade_history",
        "e-weekly-history",
        pricing("pro", "weekly_summary_history"),
      ),
    },
  },
  upgradeNudge: {
    limit_hit: upgradeNudge("limit_hit", "e-upgrade-limit", pricing("pro", "upgrade_nudge")),
    events: upgradeNudge("events", "e-upgrade-events", pricing("pro", "upgrade_nudge")),
    links: upgradeNudge("links", "e-upgrade-links", pricing("pro", "upgrade_nudge")),
    analytics: upgradeNudge("analytics", "e-upgrade-analytics", pricing("pro", "upgrade_nudge")),
    domain: upgradeNudge("domain", "e-upgrade-domain", pricing("pro", "upgrade_nudge")),
  },
  eventUsage: {
    pro: {
      80: eventUsage("pro_80", "e-events-pro-80", pricing("pro", "events_email_80")),
      90: eventUsage("pro_90", "e-events-pro-90", pricing("pro", "events_email_90")),
      100: eventUsage("pro_100", "e-events-pro-100", pricing("pro", "events_email_100")),
    },
    ultra: {
      80: eventUsage("ultra_80", "e-events-ultra-80", pricing("ultra", "events_email_80")),
      90: eventUsage("ultra_90", "e-events-ultra-90", pricing("ultra", "events_email_90")),
      100: eventUsage("ultra_100", "e-events-ultra-100", pricing("ultra", "events_email_100")),
    },
  },
  promoPaused: {
    pro: promoPaused("upgrade_pro", "e-paused-pro", pricing("pro", "events_promo_email")),
    ultra: promoPaused("upgrade_ultra", "e-paused-ultra", pricing("ultra", "events_promo_email")),
  },
  // pricing-cards.tsx opens on the plan named in `?plan=`.
  planGrace: {
    pro: planGrace("upgrade_pro", "e-grace-pro", "/dashboard/pricing?plan=pro"),
    ultra: planGrace("upgrade_ultra", "e-grace-ultra", "/dashboard/pricing?plan=ultra"),
  },
  domainReminder: {
    domains: domainReminder("domains", "e-domain-settings", "/dashboard/domains"),
  },
  apiAccessSunset: {
    pricing: apiAccessSunset("pricing", "e-api-sunset-plans", "/pricing"),
  },
} as const;

export function emailLinkUrl(link: EmailLink): string {
  return `https://${APP_BASE_DOMAIN}/${link.alias}`;
}

/** Every link in EMAIL_LINKS, for the seed script and tests. */
export const ALL_EMAIL_LINKS: readonly EmailLink[] = [
  ...Object.values(EMAIL_LINKS.welcome),
  ...Object.values(EMAIL_LINKS.firstLinkNudge),
  EMAIL_LINKS.weeklySummary.analytics,
  ...Object.values(EMAIL_LINKS.weeklySummary.upgrade),
  ...Object.values(EMAIL_LINKS.upgradeNudge),
  ...Object.values(EMAIL_LINKS.eventUsage.pro),
  ...Object.values(EMAIL_LINKS.eventUsage.ultra),
  ...Object.values(EMAIL_LINKS.promoPaused),
  ...Object.values(EMAIL_LINKS.planGrace),
  ...Object.values(EMAIL_LINKS.domainReminder),
  ...Object.values(EMAIL_LINKS.apiAccessSunset),
];
