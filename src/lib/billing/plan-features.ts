import { PLAN_CAPS, type Plan } from "@/lib/billing/plans";

const fmt = (n: number) => n.toLocaleString();

const free = PLAN_CAPS.free;
const pro = PLAN_CAPS.pro;

export const PLAN_FEATURES: Record<
  Plan,
  { tagline: string; features: string[]; comingSoon?: string[] }
> = {
  free: {
    tagline: "For tinkering and side projects.",
    features: [
      `${fmt(free.linksLimit ?? 0)} links per month`,
      `${fmt(free.eventsLimit ?? 0)} tracked events`,
      `${free.analyticsRangeLimitDays}-day analytics window`,
      "Standard QR codes",
      "1 link-in-bio page",
      "ishortn.ink links",
    ],
  },
  pro: {
    tagline: "For creators, indie makers, and growing teams.",
    features: [
      `${fmt(pro.linksLimit ?? 0)} links per month`,
      `${fmt(pro.eventsLimit ?? 0)} tracked events`,
      "Unlimited analytics history (1 year of raw events; daily summaries kept beyond that)",
      `${pro.domainLimit} custom domains`,
      "Branded + dynamic QR codes",
      "3 link-in-bio pages (custom domain, themes, no branding)",
      `Geotargeting (up to ${pro.geoRulesLimit} rules/link)`,
      `Click milestone alerts (${pro.milestonesPerLinkLimit}/link)`,
      "Password protection",
      "REST API access",
    ],
  },
  ultra: {
    tagline: "For studios, agencies, and whoever wants no ceilings.",
    features: [
      "Everything in Pro",
      "Unlimited links & events",
      "Unlimited custom domains",
      "Unlimited geo rules & milestones",
      "Link cloaking",
      "UTM parameters & templates",
      "Unlimited bio pages with scheduled blocks",
      "Team workspaces & resource transfer",
      "Priority support",
    ],
    comingSoon: [
      "Conversion tracking",
      "Device targeting",
      "Time-based routing",
      "Customization of password-protected pages",
    ],
  },
};
