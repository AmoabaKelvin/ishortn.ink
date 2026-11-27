import { PLAN_CAPS, type Plan } from "@/lib/billing/plans";

const fmt = (n: number) => n.toLocaleString();

const free = PLAN_CAPS.free;
const pro = PLAN_CAPS.pro;

type PlanFeatures = { tagline: string; features: string[]; comingSoon?: string[] };

export const PLAN_FEATURES = {
  free: {
    tagline: "For tinkering and side projects.",
    features: [
      `${fmt(free.linksLimit ?? 0)} links per month`,
      `${fmt(free.eventsLimit ?? 0)} tracked clicks`,
      `${free.analyticsRangeLimitDays}-day analytics window`,
      "5 dynamic QR codes: edit anytime, never expire, no ads",
      `1 link-in-bio page (up to ${free.bioLinkBlocksPerPageLimit} link blocks)`,
      `${free.campaignLimit} campaign with aggregate analytics`,
      "Short links on isht.app",
    ],
  },
  pro: {
    tagline: "For creators, indie makers, and growing teams.",
    features: [
      `${fmt(pro.linksLimit ?? 0)} links per month`,
      `${fmt(pro.eventsLimit ?? 0)} tracked clicks`,
      "1 year of detailed analytics (daily totals kept beyond that)",
      `${pro.domainLimit} custom domains`,
      "Branded + dynamic QR codes",
      "3 link-in-bio pages (custom domain, themes, no branding)",
      `${pro.campaignLimit} active campaigns with UTM defaults & CSV export`,
      `Geo & device targeting (up to ${pro.geoRulesLimit} rules/link)`,
      `Click milestone alerts (${pro.milestonesPerLinkLimit}/link)`,
      "Password protection",
      "Scheduled links & QR codes",
      "UTM parameters on every link",
      "REST API access",
    ],
  },
  ultra: {
    tagline: "For studios, agencies, and whoever wants no ceilings.",
    features: [
      "Everything in Pro",
      "Unlimited links & tracked clicks",
      "Unlimited custom domains",
      "Unlimited targeting rules & milestones",
      "Link cloaking",
      "UTM templates",
      "Unlimited bio pages with scheduled blocks",
      "Unlimited campaigns",
      "Team workspaces",
      "Priority support",
    ],
    comingSoon: ["Customization of password-protected pages"],
  },
} satisfies Record<Plan, PlanFeatures>;
