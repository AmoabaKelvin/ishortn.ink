import type { Metadata } from "next";

import { Footer } from "../_components/footer";
import { Header } from "../_components/header";

export const metadata: Metadata = {
  title: "Features - Free URL Shortener with Analytics | iShortn",
  description:
    "Explore iShortn's powerful features: link analytics, custom domains, QR codes, password protection, API access, and team collaboration. Everything you need to manage your links.",
  keywords: [
    "url shortener features",
    "link analytics",
    "custom domains",
    "qr code generator",
    "link management features",
  ],
  openGraph: {
    title: "Features - Free URL Shortener with Analytics | iShortn",
    description:
      "Explore iShortn's powerful features: link analytics, custom domains, QR codes, password protection, API access, and team collaboration. Everything you need to manage your links.",
    type: "website",
  },
};

const features = [
  {
    title: "Link Analytics",
    description:
      "Track every click with detailed analytics. See geographic data, device breakdowns, referrer sources, and click timing. Understand your audience and optimize your campaigns.",
    subFeatures: [
      "Real-time click tracking across all your links",
      "Geographic breakdown by country and city",
      "Device and browser analytics with OS detection",
      "Referrer source tracking to see where clicks originate",
      "Click timing and trend analysis over custom date ranges",
      "Exportable reports for campaign performance reviews",
    ],
  },
  {
    title: "Custom Domains",
    description:
      "Use your own domain for branded short links. Build trust and increase click-through rates with links like links.yourbrand.com/sale.",
    subFeatures: [
      "Connect any custom domain in minutes with simple DNS setup",
      "Branded short links that reinforce your identity",
      "Higher click-through rates with recognizable URLs",
      "Full analytics support on custom domain links",
      "SSL certificates automatically provisioned for your domain",
      "Multiple custom domains per account",
    ],
  },
  {
    title: "QR Codes",
    description:
      "Generate customizable QR codes for any link. Track scans with the same detailed analytics. Perfect for print materials, menus, and physical marketing.",
    subFeatures: [
      "Generate QR codes for any shortened link instantly",
      "Customize colors, size, and format for brand consistency",
      "Download in PNG, SVG, or PDF formats",
      "Track scans with the same analytics as link clicks",
      "Dynamic QR codes that can be updated without reprinting",
      "Ideal for business cards, flyers, menus, and packaging",
    ],
  },
  {
    title: "Password Protection",
    description:
      "Secure sensitive links with passwords. Control who can access your content with an additional layer of security.",
    subFeatures: [
      "Add a password gate to any shortened link",
      "Share confidential documents and resources securely",
      "Custom password prompt page with your branding",
      "Analytics still tracked for password-protected links",
      "Change or remove passwords at any time",
      "Ideal for internal communications and gated content",
    ],
  },
  {
    title: "Developer API",
    description:
      "Integrate link shortening into your applications with our RESTful API. Create links, retrieve analytics, and manage your account programmatically.",
    subFeatures: [
      "RESTful API with comprehensive documentation",
      "Create, update, and delete links programmatically",
      "Retrieve detailed analytics data via API endpoints",
      "API key authentication with scoped permissions",
      "Webhook support for real-time event notifications",
      "SDKs and code examples to get started quickly",
    ],
  },
  {
    title: "Team Collaboration",
    description:
      "Work together with your team. Share links, manage permissions, and collaborate on campaigns from a single dashboard.",
    subFeatures: [
      "Invite team members to your workspace",
      "Role-based access control with admin and member roles",
      "Shared link libraries accessible to the entire team",
      "Collaborative campaign management and reporting",
      "Activity logs to track who created or edited links",
      "Centralized billing and subscription management",
    ],
  },
  {
    title: "AI-Powered Security",
    description:
      "Every link is scanned for phishing and malware using advanced AI detection. Keep your audience safe from malicious content.",
    subFeatures: [
      "Automatic phishing detection on all shortened URLs",
      "AI-driven malware scanning for destination pages",
      "Real-time threat intelligence to block harmful links",
      "Protection for your brand reputation and user trust",
      "Flagged links are quarantined and reviewed",
      "Continuous monitoring even after link creation",
    ],
  },
  {
    title: "Geo-Targeting",
    description:
      "Redirect users based on their geographic location. Show different content to users in different countries or regions.",
    subFeatures: [
      "Set destination URLs per country or region",
      "Automatic detection of visitor location",
      "Default fallback URL for unmatched locations",
      "Combine with analytics to see geo-targeting performance",
      "Support for continent, country, and city-level rules",
      "Ideal for localized marketing and multi-region campaigns",
    ],
  },
];

export default function FeaturesPage() {
  return (
    <main className="relative bg-white dark:bg-card">
      <Header />

      {/* Hero */}
      <section className="px-6 pt-32 pb-12 md:pt-40 md:pb-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
            Features
          </p>
          <h1 className="mt-3 font-display text-4xl tracking-tight text-neutral-900 dark:text-foreground sm:text-5xl">
            Everything you need to manage your links
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-neutral-500 dark:text-neutral-400">
            From detailed analytics to custom domains and AI-powered security,
            iShortn gives you the tools to shorten, share, and track your links
            with confidence.
          </p>
        </div>
      </section>

      {/* Feature sections */}
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-4xl">
          <div className="space-y-20">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className={`flex flex-col gap-8 md:flex-row md:items-start md:gap-12 ${
                  index % 2 === 1 ? "md:flex-row-reverse" : ""
                }`}
              >
                {/* Text content */}
                <div className="flex-1">
                  <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 dark:bg-muted text-sm font-semibold text-neutral-500 dark:text-neutral-400">
                    {index + 1}
                  </div>
                  <h2 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-foreground">
                    {feature.title}
                  </h2>
                  <p className="mt-3 text-base leading-relaxed text-neutral-500 dark:text-neutral-400">
                    {feature.description}
                  </p>
                </div>

                {/* Sub-features list */}
                <div className="flex-1">
                  <ul className="space-y-3">
                    {feature.subFeatures.map((sub) => (
                      <li key={sub} className="flex items-start gap-3">
                        <span className="mt-1.5 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-neutral-300 dark:bg-neutral-600" />
                        <span className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                          {sub}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-neutral-100 dark:border-border/50 px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-foreground sm:text-3xl">
            Ready to get started?
          </h2>
          <p className="mt-3 text-base leading-relaxed text-neutral-500 dark:text-neutral-400">
            Create your free account and start shortening links with powerful
            analytics today.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <a
              href="/auth/sign-up"
              className="inline-flex rounded-full bg-neutral-900 px-7 py-3 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
            >
              Get Started for Free
            </a>
            <a
              href="/#pricing"
              className="inline-flex rounded-full border border-neutral-200 dark:border-border px-7 py-3 text-sm font-medium text-neutral-600 dark:text-neutral-400 transition-colors hover:border-neutral-300 dark:hover:border-border hover:text-neutral-900 dark:hover:text-foreground"
            >
              View Pricing
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
