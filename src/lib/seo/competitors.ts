// category is the product type the comparison is framed as, used in the page title and description.
// pricesCheckedOn is the ISO date the competitor's plans and prices were last verified on their
// live pricing page; it is shown on the comparison page, so bump it whenever the data is re-checked.
// guide is an optional blog post slug linked from the comparison page once the post is live.
// Optional, filled per competitor: seoTitle replaces the generated comparison title in the page
// <title> and Open Graph title (keep it under 60 characters, with the brand once); metaDescription
// replaces the generated meta description;
// migrationSteps renders an ordered "How to move" list; faqs renders an FAQ section with FAQPage
// JSON-LD; relatedGuides renders a "Related reading" list (blog links appear once the post is live);
// linksStayYours renders the "Your links stay yours" section from src/lib/copy/link-ownership.ts.
export const competitors = {
  bitly: {
    name: "Bitly",
    slug: "bitly",
    category: "URL shortener",
    seoTitle: "Bitly vs iShortn: Free Plan, Pricing and Migration (2026)",
    pricesCheckedOn: "2026-11-24",
    tagline: "The most popular URL shortener",
    description:
      "Bitly Free allows 5 links and 2 QR codes a month, with no click data and an ad page before each link opens. Here's how iShortn compares, and how to move your Bitly links.",
    metaDescription:
      "Bitly Free: 5 links a month, no click stats, an ad page. iShortn Free: 30 links with stats and no ads. Checked Nov 2026, plus how to move your links.",
    freeLinks: "5/month",
    freeAnalytics: "None on Free; 30 days of history on Core",
    customDomains: "Growth ($29/mo) and up",
    qrCodes: "2/month on free",
    apiAccess: "1,000 requests/month on free",
    teamFeatures: "Enterprise only",
    passwordProtection: "Not listed on Bitly's pricing page",
    pricing:
      "Free, Core $10/mo (billed annually only), Growth $29/mo billed annually or $35 monthly, Premium $199/mo billed annually or $300 monthly",
    whySwitch: [
      "Bitly Free allows 5 links a month, and QR codes count toward them. iShortn Free gives you 30",
      "Bitly Free shows an ad page before each link opens. iShortn has no ad page on any plan",
      "Bitly Free has no click data. iShortn Free shows location, device and referrer for the last 7 days",
      "Bitly Core is $10/month billed annually, and custom domains need Growth at $29/month billed annually. iShortn Pro is $8/month with 3 custom domains",
      "You can change a link's destination on every iShortn plan. Bitly Free can't change a destination, and Core allows 5 changes a month",
      "iShortn Free includes 5 dynamic QR codes: edit the destination anytime, they never expire, and there are no ads",
      "Send a client a read-only stats page for any iShortn link or QR code, on every plan. They don't need an account",
      "Monthly iShortn plans can pause billing for 1 to 3 months instead of cancelling, and your links keep redirecting",
    ],
    linksStayYours: true,
    migrationSteps: [
      "Check where your links live. Links on bit.ly stay with Bitly, because Bitly owns that domain. Links on your own domain, such as go.yourbrand.com, keep their exact addresses.",
      "In Bitly, open Links, click Export and download the CSV from the email Bitly sends. Bitly lists export on Growth and higher.",
      "Add the same domain in iShortn under Domains, then replace Bitly's DNS records with the ones iShortn shows.",
      "Upload Bitly's CSV unchanged with Upload CSV. Custom back-halves become aliases, and Bitly's random codes can keep working too.",
      "Open a few old links in a private window and scan a printed QR code. When they all redirect, you can cancel Bitly.",
    ],
    faqs: [
      {
        question: "Is Bitly still free?",
        answer:
          "Yes. Bitly Free allows 5 links a month, and QR codes count toward them (2 a month). It shows no click or scan data, can't change a link's destination, and opens free links on a page with an ad. Paid plans start with Core at $10 a month, billed annually only.",
      },
      {
        question: "Is iShortn a good alternative to Bitly?",
        answer:
          "For small businesses, creators and freelancers, usually yes. iShortn Free gives you 30 links a month with location, device and referrer stats and no ad page, while Bitly Free allows 5 links with no click data. iShortn Pro is $8 a month with 3 custom domains; Bitly's custom domains start on Growth at $29 a month billed annually. Bitly is the better fit if you need SSO, an uptime SLA or API access on a free plan.",
      },
      {
        question: "Can I move my Bitly links to iShortn without breaking them?",
        answer:
          "Links on your own domain keep their exact addresses: export them from Bitly, point the domain to iShortn and upload Bitly's CSV unchanged. Printed QR codes that open your domain keep working. Links on bit.ly can't move, because Bitly owns that domain, so the import creates a new short link for each one.",
      },
      {
        question: "Which Bitly plan do I need to export my links?",
        answer:
          "Bitly lists data export on Growth, Premium and Enterprise. Free and Core don't include a custom domain, so their links are all on bit.ly and couldn't keep their addresses anyway.",
      },
      {
        question: "Does iShortn have an API like Bitly?",
        answer:
          "Yes. iShortn has a REST API for creating links and reading analytics on Pro and Ultra. iShortn Free has no API access, while Bitly Free includes 1,000 API requests a month.",
      },
      {
        question: "Does iShortn show ads before links open?",
        answer:
          "No, on any plan. Bitly Free shows a page with an ad before each link opens, and Bitly's paid plans remove it.",
      },
    ],
    relatedGuides: [
      { href: "/docs/migrate-from-bitly", label: "Move your links from Bitly, step by step" },
      { href: "/docs/bulk-import", label: "CSV bulk import: file format and limits" },
      { href: "/blog/bitly-free-plan-limits", label: "Bitly free plan limits in 2026" },
      { href: "/blog/bitly-alternatives", label: "The best Bitly alternatives, free and paid" },
      { href: "/blog/best-free-url-shorteners", label: "The best free URL shorteners compared" },
      {
        href: "/blog/url-shortener-vs-link-management-platform",
        label: "URL shortener vs link management platform",
      },
      { href: "/compare/tinyurl", label: "iShortn vs TinyURL" },
      { href: "/compare/short-io", label: "iShortn vs Short.io" },
      { href: "/compare/dub", label: "iShortn vs Dub" },
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
    seoTitle: "TinyURL vs iShortn: Free Click Tracking and Pricing (2026)",
    pricesCheckedOn: "2026-11-23",
    tagline: "The original URL shortener",
    description:
      "TinyURL Free gives you 30 links a month but no click data. iShortn Free also gives you 30, and shows where every click came from. Here's how the two compare, and how to move your links.",
    metaDescription:
      "TinyURL Free gives 30 links a month with no click stats. iShortn Free gives 30 with country, device and referrer data. Prices checked November 2026.",
    freeLinks: "30/month (no cap without an account)",
    freeAnalytics: "None",
    customDomains: "Paid only",
    qrCodes: "Yes (static)",
    apiAccess: "Yes (free account)",
    teamFeatures: "None",
    passwordProtection: "None",
    pricing:
      "Free, Pro $9/mo billed annually ($11 monthly) for 125 links a month, Bulk 50K $69/mo billed annually ($83 monthly)",
    whySwitch: [
      "TinyURL Free has no click stats. iShortn Free records the country, city, device, browser and referrer of up to 1,000 clicks and scans a month",
      "No custom domains or password protection on TinyURL free",
      "TinyURL Pro starts at $9/month (billed annually) for 125 links a month — iShortn Pro is $8/month for 1,000 links",
      "iShortn includes AI-powered link safety scanning on all plans",
      "TinyURL is the better fit if you only need a quick link without an account. iShortn needs a free account to create links",
    ],
    linksStayYours: true,
    migrationSteps: [
      "Check where your links live. Links on your own domain, such as go.yourbrand.com, can keep their exact addresses. Links on tinyurl.com stay with TinyURL, because TinyURL owns that domain.",
      "Get a list of your TinyURL links and their destinations as a CSV file.",
      "Name the columns iShortn reads: url for the destination, alias for the back-half and domain for your own domain. Other columns are ignored.",
      "On Pro, add the same domain in iShortn under Domains, then replace TinyURL's DNS records with the ones iShortn shows.",
      "Upload the file with Upload CSV in the dashboard. On Pro, rows on your custom domain use a one-time 5,000-link import allowance instead of the monthly limit.",
      "Open a few old links in a private window and scan a printed QR code. When they all redirect, you can cancel TinyURL.",
    ],
    faqs: [
      {
        question: "Does TinyURL show click stats on the free plan?",
        answer:
          "No. TinyURL's pricing table marks tracked clicks, the analytics dashboard and analytics history as not included on Free. iShortn Free records the country, city, device, browser and referrer for up to 1,000 clicks and scans a month and keeps 7 days of history.",
      },
      {
        question: "How much does TinyURL cost?",
        answer:
          "TinyURL Pro lists at $9 a month billed annually ($108 a year) or $11 billed monthly, for 125 links a month. Bulk 50K lists at $69 a month billed annually or $83 monthly. iShortn Pro is $8 a month, or $80 a year, for 1,000 links a month. TinyURL prices from tinyurl.com/app/pricing, checked 23 November 2026.",
      },
      {
        question: "Is iShortn a good alternative to TinyURL?",
        answer:
          "If you want to see who clicks your links, yes. Both free plans give you 30 links a month, but only iShortn's shows click data, and you can change a link's destination on every iShortn plan. TinyURL is quicker for a one-off link, because it doesn't need an account.",
      },
      {
        question: "Can I use my own domain on TinyURL's free plan?",
        answer:
          "No. TinyURL lists bringing your own domain on paid plans only. On iShortn, custom domains start on Pro at $8 a month, with up to 3 domains.",
      },
    ],
    relatedGuides: [
      { href: "/blog/tinyurl-alternatives", label: "TinyURL alternatives with free click stats" },
      { href: "/blog/how-to-track-link-clicks", label: "How to track link clicks" },
      { href: "/docs/bulk-import", label: "CSV bulk import: file format and limits" },
      { href: "/compare/bitly", label: "Bitly vs iShortn" },
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
    seoTitle: "Rebrandly vs iShortn: Free Plan and Custom Domains (2026)",
    pricesCheckedOn: "2026-11-23",
    tagline: "Branded link management platform",
    description:
      "Rebrandly focuses on branded links, with a free tier that includes one custom domain, but iShortn delivers more links and analytics at a lower price.",
    metaDescription:
      "Rebrandly Free gives 10 links a month and detailed stats on 100 clicks. iShortn Free gives 30 links and stats on 1,000; Pro adds 3 custom domains for $8/mo.",
    freeLinks: "10/month",
    freeAnalytics: "Detailed stats on 100 clicks/month (clicks themselves unlimited)",
    customDomains: "1 on Free (your own or a free .bio domain); 2 on Essentials",
    qrCodes: "10/month on Free, with a watermark",
    apiAccess: "Yes (100 calls/min on free)",
    teamFeatures: "Paid only",
    passwordProtection: "Paid only",
    pricing: "Free, paid plans from Essentials",
    whySwitch: [
      "Rebrandly Free gives 10 links a month and detailed stats on 100 clicks. iShortn Free gives 30 links a month and stats on up to 1,000 clicks and scans",
      "Rebrandly Free includes 1 custom domain and 10 links a month. iShortn Pro includes 3 custom domains, 1,000 links a month and 10,000 tracked events for $8/month",
      "Rebrandly QR codes have watermarks on free — iShortn QR codes are clean on all plans",
      "iShortn Pro adds geo and device targeting for $8/month, and AI-powered phishing detection checks links on every plan",
      "Rebrandly is the better fit if you want a custom domain on a free plan: Rebrandly Free includes one, and iShortn's start on Pro",
    ],
    linksStayYours: true,
    migrationSteps: [
      "Check where your links live. Links on your own domain, such as go.yourbrand.com, can keep their exact addresses. Links on rebrand.ly stay with Rebrandly, because Rebrandly owns that domain.",
      "Get a list of your Rebrandly links and their destinations as a CSV file.",
      "Name the columns iShortn reads: url for the destination, alias for the back-half and domain for your own domain. Other columns are ignored.",
      "On Pro, add the same domain in iShortn under Domains, then replace Rebrandly's DNS records with the ones iShortn shows.",
      "Upload the file with Upload CSV in the dashboard. On Pro, rows on your custom domain use a one-time 5,000-link import allowance instead of the monthly limit.",
      "Open a few old links in a private window and scan a printed QR code. When they all redirect, you can cancel Rebrandly.",
    ],
    faqs: [
      {
        question: "Is iShortn a good alternative to Rebrandly?",
        answer:
          "If you need more than 10 links a month or more than 100 clicks of detailed stats, yes. iShortn Free gives you 30 links a month with stats on up to 1,000 clicks and scans, and Pro adds 1,000 links a month and 3 custom domains for $8 a month. Rebrandly is the better fit if you want a custom domain without paying, because Rebrandly Free includes one.",
      },
      {
        question: "What does Rebrandly's free plan include?",
        answer:
          "Rebrandly Free includes 10 links and 10 QR codes a month, one custom domain (your own or a .bio domain) plus the rebrand.ly domain, and unlimited clicks with detailed stats on 100 of them a month. Free QR codes carry a Rebrandly watermark. From rebrandly.com/pricing, checked 23 November 2026.",
      },
      {
        question: "How does Rebrandly compare with Short.io?",
        answer:
          "On the free plans, Short.io gives 1,000 links in total, 5 custom domains and 50,000 tracked clicks a month. Rebrandly gives 10 links a month, one custom domain and detailed stats on 100 clicks a month. iShortn Free sits between them: 30 links every month and stats on 1,000 clicks, with custom domains from Pro at $8 a month. Our Short.io comparison is at ishortn.ink/compare/short-io.",
      },
      {
        question: "Can I move my Rebrandly links to iShortn without breaking them?",
        answer:
          "Links on your own domain can keep their exact addresses: upload a CSV of them to iShortn and point the domain's DNS to iShortn. Custom domains are on Pro and Ultra. Links on rebrand.ly can't move, because Rebrandly owns that domain, so the import gives each one a new short link.",
      },
    ],
    relatedGuides: [
      { href: "/blog/rebrandly-alternatives", label: "Rebrandly alternatives compared" },
      { href: "/compare/short-io", label: "Short.io vs iShortn" },
      { href: "/docs/custom-domains", label: "Connect your own domain" },
      { href: "/docs/bulk-import", label: "CSV bulk import: file format and limits" },
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
    seoTitle: "Short.io vs iShortn: Pricing and Free Plan Compared (2026)",
    pricesCheckedOn: "2026-11-23",
    tagline: "White-label link shortener",
    description:
      "Short.io is a solid link shortener focused on custom domains, but iShortn offers a more complete feature set at a better price.",
    metaDescription:
      "Short.io Free gives 1,000 links in total; iShortn Free gives 30 every month. Compare prices, custom domains and click analytics, checked November 2026.",
    freeLinks: "1,000 in total (not per month)",
    freeAnalytics: "50,000 tracked clicks/month",
    customDomains: "5 on free plan",
    qrCodes: "Yes",
    apiAccess: "Yes (1,000 API links)",
    teamFeatures: "Paid only",
    passwordProtection: "Paid only",
    pricing:
      "Free, Hobby $5/mo, Pro $18/mo, Team $48/mo, Enterprise $148/mo (about 17% less billed annually)",
    whySwitch: [
      "Short.io Free gives 1,000 links in total, and they don't reset. iShortn Free gives 30 new links every month",
      "Short.io Pro is $18/month and Team is $48/month — iShortn Pro is just $8/month",
      "iShortn Pro ($8/month) includes password protection, and AI-powered phishing detection checks links on every plan",
      "Short.io is the better fit if you need custom domains for free: Short.io Free includes 5, while iShortn's start on Pro",
    ],
    linksStayYours: true,
    migrationSteps: [
      "Check where your links live. Links on your own domain, such as go.yourbrand.com, can keep their exact addresses. Links on Short.io's shared domains stay with Short.io, because Short.io owns those domains.",
      "Get a list of your Short.io links and their destinations as a CSV file.",
      "Name the columns iShortn reads: url for the destination, alias for the back-half and domain for your own domain. Other columns are ignored.",
      "On Pro, add the same domain in iShortn under Domains, then replace Short.io's DNS records with the ones iShortn shows.",
      "Upload the file with Upload CSV in the dashboard. On Pro, rows on your custom domain use a one-time 5,000-link import allowance instead of the monthly limit.",
      "Open a few old links in a private window and scan a printed QR code. When they all redirect, you can cancel Short.io.",
    ],
    faqs: [
      {
        question: "Is iShortn a good alternative to Short.io?",
        answer:
          "If you need fresh links every month and a cheaper paid plan, yes. iShortn Free gives you 30 new links a month with location, device and referrer stats, and Pro is $8 a month for 1,000 links a month and 3 custom domains. Short.io Pro is $18 a month. Short.io is the better fit if you want custom domains without paying: Short.io Free includes 5, and iShortn's custom domains start on Pro.",
      },
      {
        question: "How much does Short.io cost?",
        answer:
          "Short.io lists Free, Hobby at $5 a month, Pro at $18, Team at $48 and Enterprise at $148. Billed annually they cost $50, $180, $480 and $1,480 a year. Prices from short.io/pricing, checked 23 November 2026.",
      },
      {
        question: "Is the Short.io free plan 1,000 links a month?",
        answer:
          "No. Short.io's pricing table lists 1,000 branded links in total on Free, with 50,000 tracked clicks a month and 5 custom domains. iShortn Free resets every month: 30 links and 1,000 tracked clicks and scans, with 7 days of analytics.",
      },
      {
        question: "Can I move my Short.io links to iShortn without breaking them?",
        answer:
          "Links on your own domain can keep their exact addresses: upload a CSV of them to iShortn and point the domain's DNS to iShortn. Custom domains are on Pro and Ultra. Links on Short.io's shared domains can't move, because Short.io owns those domains, so the import gives each one a new short link.",
      },
    ],
    relatedGuides: [
      { href: "/docs/bulk-import", label: "CSV bulk import: file format and limits" },
      { href: "/docs/custom-domains", label: "Connect your own domain" },
      { href: "/blog/short-io-alternatives", label: "Short.io alternatives compared" },
      { href: "/compare/rebrandly", label: "Rebrandly vs iShortn" },
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
    seoTitle: "Dub.co vs iShortn: Pricing and Free Plan Compared (2026)",
    pricesCheckedOn: "2026-11-23",
    tagline: "Open-source link management",
    description:
      "Dub.co is an open-source link management platform popular with developers. See how iShortn compares on features and pricing.",
    metaDescription:
      "Dub Free allows 25 new links a month and Pro starts at $30/month. iShortn Free allows 30, and Pro is $8/month with 3 custom domains. Checked Nov 2026.",
    freeLinks: "25 new links/month",
    freeAnalytics: "Yes (30-day history, 1K events/mo)",
    customDomains: "3 on Free, more on paid plans",
    qrCodes: "Yes",
    apiAccess: "Yes",
    teamFeatures: "Paid only",
    passwordProtection: "Paid only",
    pricing:
      "Free; Pro $30/mo ($27/mo billed yearly) for 1,000 new links a month; Business $90/mo ($81/mo billed yearly)",
    whySwitch: [
      "Dub Free allows 25 new links a month; iShortn Free allows 30 and includes 5 dynamic QR codes",
      "Dub's paid plans start at $30/month; iShortn Pro is $8/month with 3 custom domains",
      "iShortn Pro unlocks unlimited analytics history for $8/month",
      "iShortn includes password protection and geo-targeting on the Pro plan",
      "Dub is the better fit if you run an affiliate or partner program (Dub Partners), or want 30 days of analytics and 3 custom domains on a free plan",
    ],
    linksStayYours: true,
    migrationSteps: [
      "Check where your links live. Links on your own domain, such as go.yourbrand.com, can keep their exact addresses. Links on Dub's shared domains stay with Dub, because Dub owns those domains.",
      "Get a list of your Dub links and their destinations as a CSV file.",
      "Name the columns iShortn reads: url for the destination, alias for the back-half and domain for your own domain. Other columns are ignored.",
      "On Pro, add the same domain in iShortn under Domains, then replace Dub's DNS records with the ones iShortn shows.",
      "Upload the file with Upload CSV in the dashboard. On Pro, rows on your custom domain use a one-time 5,000-link import allowance instead of the monthly limit.",
      "Open a few old links in a private window and scan a printed QR code. When they all redirect, you can cancel Dub.",
    ],
    faqs: [
      {
        question: "Is iShortn a cheaper alternative to Dub?",
        answer:
          "Yes, for short links with click analytics. iShortn Pro is $8 a month with 1,000 links a month and 3 custom domains. Dub's paid plans start at Pro, $30 a month or $27 billed yearly. Dub is the better fit if you run an affiliate or partner program, which iShortn doesn't offer.",
      },
      {
        question: "What does Dub's free plan include?",
        answer:
          "Dub Free includes 25 new links a month, 1,000 tracked events, 30 days of analytics and 3 custom domains for 1 user. iShortn Free includes 30 links a month, 1,000 tracked clicks and scans, 7 days of analytics and 5 dynamic QR codes; custom domains start on Pro. Dub figures from dub.co/pricing/links, checked 23 November 2026.",
      },
      {
        question: "What are the best Dub.co alternatives?",
        answer:
          "It depends on what you use Dub for. For branded short links and click analytics at a lower price, look at iShortn, Short.io and Rebrandly. Our guide compares them on free plans and prices: ishortn.ink/blog/dub-alternatives.",
      },
      {
        question: "Are Dub and iShortn both open source?",
        answer:
          "Yes. iShortn's code is MIT-licensed and you can self-host it on Cloudflare Workers with a MySQL database, using the self-hosting guide at ishortn.ink/docs/self-hosting. Dub's code is public too.",
      },
    ],
    relatedGuides: [
      { href: "/blog/dub-alternatives", label: "Dub.co alternatives: free and cheaper options" },
      { href: "/docs/bulk-import", label: "CSV bulk import: file format and limits" },
      { href: "/docs/self-hosting", label: "Self-hosting iShortn" },
      { href: "/compare/short-io", label: "Short.io vs iShortn" },
    ],
    guide: {
      slug: "dub-alternatives",
      label: "Looking at more options? Read our guide to Dub.co alternatives.",
    },
  },
  linktree: {
    name: "Linktree",
    slug: "linktree",
    category: "link in bio",
    pricesCheckedOn: "2026-11-22",
    tagline: "The default link-in-bio — but you pay to see what's working",
    description:
      "Linktree is the most recognized link-in-bio tool, with a generous free page and a huge template library. The catch: the analytics that show which links convert sit behind paid plans. See how iShortn compares.",
    freeLinks: "Unlimited links on the bio page",
    freeAnalytics: "Last 28 days on Free; 90 days on Starter, 365 on Pro, lifetime on Premium",
    customDomains: "Not available on any plan",
    qrCodes: "Yes, all plans",
    apiAccess: "No public REST API (offers an MCP server for AI assistants)",
    teamFeatures: "Separate team plans with roles and permissions",
    passwordProtection: "Password and code lock on Pro and Premium",
    pricing:
      "Free, Starter $9/mo ($7/mo billed annually), Pro $17/mo ($14/mo billed annually), Premium $35/mo ($30/mo billed annually)",
    whySwitch: [
      "Every link on an iShortn bio page is a tracked short link with click, geo, device and referrer data, on every plan including Free",
      "iShortn shows clicks for each bio link on the free plan; Linktree's individual link insights start on Starter ($9/mo, or $7/mo billed annually)",
      "iShortn Pro ($8/mo) keeps a year of detailed click data and daily click totals for good; on Linktree a year of history needs Pro ($17/mo, or $14/mo billed annually) and all-time history needs Premium",
      "iShortn is link-in-bio plus a full URL shortener, QR codes, and analytics in one tool — not a bio page with analytics sold separately",
      "Linktree doesn't support custom domains on any plan — iShortn Pro ($8/mo) serves your bio page and short links on your own domain",
      "iShortn Pro ($8/mo) includes password-protected links; Linktree's password and code lock needs its Pro plan ($17/mo, or $14/mo billed annually)",
      "iShortn Pro includes a REST API for links and analytics; Linktree has no public REST API",
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
  "seoTitle" in competitor
    ? competitor.seoTitle
    : `${competitor.name} vs iShortn: ${competitor.category} comparison`;
