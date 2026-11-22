// category is the product type the comparison is framed as, used in the page title and description.
// pricesCheckedOn is the ISO date the competitor's plans and prices were last verified on their
// live pricing page; it is shown on the comparison page, so bump it whenever the data is re-checked.
// guide is an optional blog post slug linked from the comparison page once the post is live.
export const competitors = {
  bitly: {
    name: "Bitly",
    slug: "bitly",
    category: "URL shortener",
    pricesCheckedOn: "2026-11-21",
    tagline: "The most popular URL shortener",
    description:
      "Bitly is the most well-known URL shortener, but its free plan has become extremely restrictive. See how iShortn compares.",
    freeLinks: "5/month",
    freeAnalytics: "No analytics history",
    customDomains: "Growth ($29/mo) and up",
    qrCodes: "2/month on free",
    apiAccess: "1,000 requests/month on free",
    teamFeatures: "Enterprise only",
    passwordProtection: "Paid only",
    pricing: "Free, Core $10/mo (billed annually only), Growth $29/mo",
    whySwitch: [
      "Bitly's free plan only allows 5 links per month — iShortn gives you 30",
      "Bitly free links may show interstitial ad pages before redirecting",
      "Bitly Core is $10/month billed annually, and custom domains need Growth at $29/month — iShortn Pro is $8/month with 3 custom domains",
      "iShortn Free includes 5 dynamic QR codes: edit the destination anytime, they never expire, and there are no ads",
      "iShortn adds password protection on Pro and Ultra",
    ],
    migrationGuide: {
      href: "/docs/migrate-from-bitly",
      label:
        "Moving from Bitly? Import your Bitly export and keep the addresses on your own domain.",
    },
    guide: {
      slug: "bitly-alternatives",
      label: "Weighing other options? Read our guide to the best Bitly alternatives.",
    },
  },
  tinyurl: {
    name: "TinyURL",
    slug: "tinyurl",
    category: "URL shortener",
    pricesCheckedOn: "2026-11-21",
    tagline: "The original URL shortener",
    description:
      "TinyURL was one of the first URL shorteners, but it lacks analytics and modern features. See how iShortn compares.",
    freeLinks: "30/month (no cap without an account)",
    freeAnalytics: "None",
    customDomains: "Paid only",
    qrCodes: "Yes (static)",
    apiAccess: "Yes (free account)",
    teamFeatures: "None",
    passwordProtection: "None",
    pricing: "Free, Pro from $9/mo (billed annually), Bulk from $69/mo (billed annually)",
    whySwitch: [
      "TinyURL offers zero analytics on the free plan — iShortn tracks every click with detailed data",
      "No custom domains or password protection on TinyURL free",
      "TinyURL Pro starts at $9/month (billed annually) for 125 links a month — iShortn Pro is $8/month for 1,000 links",
      "iShortn includes AI-powered link safety scanning on all plans",
    ],
    guide: {
      slug: "tinyurl-alternatives",
      label: "Weighing other options? Read our guide to TinyURL alternatives.",
    },
  },
  rebrandly: {
    name: "Rebrandly",
    slug: "rebrandly",
    category: "URL shortener",
    pricesCheckedOn: "2026-11-20",
    tagline: "Branded link management platform",
    description:
      "Rebrandly focuses on branded links with a free tier that includes one custom domain, but iShortn delivers more analytics at a lower price.",
    freeLinks: "10/month",
    freeAnalytics: "100 tracked clicks/month",
    customDomains: "1 on free plan",
    qrCodes: "Watermarked on free",
    apiAccess: "Paid only",
    teamFeatures: "Paid only",
    passwordProtection: "Paid only",
    pricing: "Free, paid plans from Essentials",
    whySwitch: [
      "Rebrandly free gives 10 links and 100 tracked clicks a month — iShortn gives 30 links and 1,000 tracked events",
      "Rebrandly Free includes 1 custom domain and 100 tracked clicks a month. iShortn Pro includes 3 custom domains and 10,000 tracked events for $8/month",
      "Rebrandly QR codes have watermarks on free — iShortn QR codes are clean on all plans",
      "iShortn Pro adds geo and device targeting for $8/month, and AI-powered phishing detection checks links on every plan",
    ],
    guide: {
      slug: "rebrandly-alternatives",
      label: "Weighing other options? Read our guide to Rebrandly alternatives.",
    },
  },
  "short-io": {
    name: "Short.io",
    slug: "short-io",
    category: "URL shortener",
    pricesCheckedOn: "2026-11-20",
    tagline: "White-label link shortener",
    description:
      "Short.io is a solid link shortener focused on custom domains, but iShortn offers a more complete feature set at a better price.",
    freeLinks: "1,000 total",
    freeAnalytics: "50,000 tracked clicks/month",
    customDomains: "5 on free plan",
    qrCodes: "Yes",
    apiAccess: "Yes (1,000 API links)",
    teamFeatures: "Paid only",
    passwordProtection: "Paid only",
    pricing: "Free, Hobby $5/mo, Pro $18/mo, Team $48/mo",
    whySwitch: [
      "Short.io free gives 1,000 links total lifetime — iShortn gives fresh links every month",
      "Short.io Pro is $18/month and Team is $48/month — iShortn Pro is just $8/month",
      "iShortn Pro ($8/month) includes password protection, and AI-powered phishing detection checks links on every plan",
    ],
    guide: {
      slug: "short-io-alternatives",
      label: "Weighing other options? Read our guide to Short.io alternatives.",
    },
  },
  dub: {
    name: "Dub.co",
    slug: "dub",
    category: "URL shortener",
    pricesCheckedOn: "2026-11-21",
    tagline: "Open-source link management",
    description:
      "Dub.co is an open-source link management platform popular with developers. See how iShortn compares on features and pricing.",
    freeLinks: "25 new links/month",
    freeAnalytics: "Yes (30-day history, 1K events/mo)",
    customDomains: "3 on Free, more on paid plans",
    qrCodes: "Yes",
    apiAccess: "Yes",
    teamFeatures: "Paid only",
    passwordProtection: "Paid only",
    pricing: "Free; Pro from $30/mo ($27/mo yearly); Business $90/mo",
    whySwitch: [
      "Dub Free allows 25 new links a month; iShortn Free allows 30 and includes 5 dynamic QR codes",
      "Dub's paid plans start at $30/month; iShortn Pro is $8/month with 3 custom domains",
      "iShortn Pro unlocks unlimited analytics history for $8/month",
      "iShortn includes password protection and geo-targeting on the Pro plan",
    ],
    guide: {
      slug: "dub-alternatives",
      label: "Weighing other options? Read our guide to Dub.co alternatives.",
    },
  },
  linktree: {
    name: "Linktree",
    slug: "linktree",
    category: "link in bio",
    pricesCheckedOn: "2026-11-21",
    tagline: "The default link-in-bio — but you pay to see what's working",
    description:
      "Linktree is the most recognized link-in-bio tool, with a generous free page and a huge template library. The catch: the analytics that show which links convert sit behind paid plans. See how iShortn compares.",
    freeLinks: "Unlimited links on the bio page",
    freeAnalytics: "Last 28 days on Free; 90 days on Starter, 365 on Pro, lifetime on Premium",
    customDomains: "Not available on any plan",
    qrCodes: "Yes, all plans",
    apiAccess: "No public API",
    teamFeatures: "Higher paid tiers only",
    passwordProtection: "Per-link lock on Pro and Premium; whole-page lock from Starter",
    pricing:
      "Free, Starter $9/mo ($7/mo billed annually), Pro $17/mo ($14/mo billed annually), Premium $35/mo ($30/mo billed annually)",
    whySwitch: [
      "Every link on an iShortn bio page is a tracked short link with click, geo, device and referrer data, on every plan including Free",
      "iShortn Pro ($8/mo) keeps your full analytics history; on Linktree a year of history needs Pro ($17/mo, or $14/mo billed annually) and lifetime history needs Premium",
      "iShortn is link-in-bio plus a full URL shortener, QR codes, and analytics in one tool — not a bio page with analytics sold separately",
      "Linktree doesn't support custom domains on any plan — iShortn Pro ($8/mo) serves your bio page and short links on your own domain",
      "iShortn Pro ($8/mo) includes password-protected links; Linktree's per-link lock needs its Pro plan ($17/mo, or $14/mo billed annually)",
      "iShortn Pro includes a REST API for links and analytics — Linktree has no comparable public API",
    ],
    guide: {
      slug: "linktree-custom-domain",
      label:
        "Want your bio page on your own domain? Read our guide to Linktree and custom domains.",
    },
  },
  beacons: {
    name: "Beacons",
    slug: "beacons",
    category: "link in bio",
    pricesCheckedOn: "2026-11-21",
    tagline: "A creator-commerce platform first, a link-in-bio second",
    description:
      "Beacons bundles a link-in-bio with stores, email, and AI tools for creators who sell. That breadth is powerful, but it comes with transaction fees and a busier product if you just want a fast, tracked bio page. See how iShortn compares.",
    freeLinks: "Unlimited links on the bio page",
    freeAnalytics: "Real-time, but built around the storefront",
    customDomains: "Paid only (free first year)",
    qrCodes: "Yes",
    apiAccess: "No public API",
    teamFeatures: "Higher paid tiers only",
    passwordProtection: "Per-link password or age check (added October 2026)",
    pricing:
      "Free (9% seller fee), Creator $10/mo ($8.33/mo billed annually, 9% seller fee), Creator Plus $30/mo, Creator Max $100/mo",
    whySwitch: [
      "Beacons charges up to a 9% transaction fee to monetize — iShortn is a flat subscription (Free $0, Pro $8/mo, Ultra $15/mo) with no per-sale cut",
      "Every iShortn bio link is a tracked short link with click, geo, device, and referrer data on all plans — see where your audience comes from, not just store conversions",
      "If you just want a fast, tracked bio page plus short links and QR codes, iShortn does it in one focused tool instead of a sprawling commerce suite",
      "iShortn Pro ($8/mo) includes 3 custom domains outright, while Beacons gates domains to paid plans (free only for year one)",
      "iShortn Pro includes a REST API for links and analytics — Beacons offers no equivalent public API",
    ],
  },
  carrd: {
    name: "Carrd",
    slug: "carrd",
    category: "link in bio",
    pricesCheckedOn: "2026-11-21",
    tagline: "A great one-page site builder — not a link-in-bio analytics tool",
    description:
      "Carrd is a beloved, low-cost way to build simple one-page sites, and at $9 to $49/year it's hard to beat on price. But it's a site builder, not a link tool: there are no short links, and analytics and QR codes need a paid plan. See how iShortn compares.",
    freeLinks: "Up to 3 one-page sites (carrd.co subdomain + badge)",
    freeAnalytics:
      "None on Free; Google Analytics or Carrd's own analytics from Pro Standard ($19/yr)",
    customDomains: "From $19/yr (Pro Standard)",
    qrCodes: "From Pro Lite ($9/yr)",
    apiAccess: "No public API",
    teamFeatures: "Site sharing with Editor access on paid plans",
    passwordProtection: "Pro Plus ($49/yr) only",
    pricing: "Free, Pro Lite $9/yr, Pro Standard $19/yr, Pro Plus $49/yr",
    whySwitch: [
      "iShortn gives every bio link click, geo, device and referrer analytics on every plan; Carrd has no analytics on Free, and its analytics start at Pro Standard ($19/yr)",
      "iShortn is a bio page plus a real URL shortener and QR codes in one tool; Carrd is a site builder with no short links or per-link tracking, and QR codes start on a paid plan",
      "iShortn's free plan includes a bio page, 30 tracked short links/month, and 5 dynamic QR codes",
      "iShortn Pro ($8/mo) adds password-protected links and removes branding; Carrd only unlocks password protection on its $49/yr Pro Plus plan",
      "iShortn Pro includes a REST API for links and analytics, which Carrd doesn't offer",
    ],
  },
} as const;

export type Competitor = (typeof competitors)[keyof typeof competitors];

export function getCompetitor(slug: string): Competitor | undefined {
  return Object.values(competitors).find((c) => c.slug === slug);
}

export const comparisonTitle = (competitor: Competitor) =>
  `${competitor.name} vs iShortn: ${competitor.category} comparison`;
