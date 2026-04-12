"use client";

import {
  IconApi,
  IconArrowRight,
  IconBolt,
  IconBrandGithub,
  IconCheck,
  IconChartBar,
  IconClock,
  IconDeviceAnalytics,
  IconFolders,
  IconGlobe,
  IconLink,
  IconLockAccess,
  IconQrcode,
  IconRoute,
  IconShieldCheck,
  IconShieldLock,
  IconSparkles,
  IconUsers,
  IconWorld,
  IconX,
} from "@tabler/icons-react";
import { motion, useInView } from "framer-motion";
import { Link } from "next-view-transitions";
import { useRef } from "react";

import { Paths } from "@/lib/constants/app";

// ---------------------------------------------------------------------------
// Reveal helper — scroll-triggered fade/slide
// ---------------------------------------------------------------------------

type RevealProps = {
  children: React.ReactNode;
  delay?: number;
  className?: string;
};

const Reveal = ({ children, delay = 0, className }: RevealProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
      transition={{ duration: 0.4, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

// ---------------------------------------------------------------------------
// Visual mocks for two-column showcases
// ---------------------------------------------------------------------------

const AnalyticsMock = () => {
  const bars = [42, 68, 55, 82, 61, 94, 72, 88, 65];
  const regions = [
    { label: "United States", pct: 42 },
    { label: "United Kingdom", pct: 18 },
    { label: "Germany", pct: 14 },
    { label: "Japan", pct: 9 },
  ];

  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/50 p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500">Clicks · last 7 days</p>
        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
          Live
        </span>
      </div>
      <p className="mt-1 font-heading text-2xl font-bold text-zinc-50">24,847</p>
      <div className="mt-4 flex h-28 items-end gap-1.5">
        {bars.map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm bg-blue-500/80"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      <div className="mt-4 space-y-2">
        {regions.map((r) => (
          <div key={r.label} className="flex items-center gap-3">
            <span className="w-28 text-xs text-zinc-400">{r.label}</span>
            <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-zinc-700/60">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-blue-400"
                style={{ width: `${r.pct}%` }}
              />
            </div>
            <span className="w-8 text-right text-xs text-zinc-500">{r.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const DomainQrMock = () => {
  const domains = [
    { url: "links.acme.co", status: "active" },
    { url: "go.startup.io", status: "active" },
    { url: "s.brand.com", status: "active" },
  ];

  const qrPattern = [
    [1, 1, 1, 0, 1, 0, 1, 1],
    [1, 0, 1, 1, 0, 1, 0, 1],
    [1, 1, 1, 0, 1, 1, 1, 0],
    [0, 0, 0, 1, 0, 0, 1, 1],
    [1, 0, 1, 0, 1, 1, 0, 0],
    [0, 1, 1, 1, 0, 1, 1, 1],
    [1, 0, 0, 1, 1, 0, 1, 0],
    [1, 1, 1, 0, 0, 1, 1, 1],
  ];

  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/50 p-5">
      <p className="text-xs text-zinc-500">Connected domains</p>
      <div className="mt-3">
        {domains.map((d, i) => (
          <div
            key={d.url}
            className={`flex items-center justify-between py-2.5 ${
              i < domains.length - 1 ? "border-b border-zinc-700/50" : ""
            }`}
          >
            <div className="flex items-center gap-2">
              <IconGlobe size={14} className="text-zinc-500" />
              <span className="text-sm text-zinc-50">{d.url}</span>
            </div>
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
          </div>
        ))}
      </div>
      <div className="mt-5 flex items-center gap-4 rounded-lg border border-zinc-700/50 bg-zinc-900/60 p-4">
        <div className="inline-grid shrink-0 grid-cols-8 gap-px">
          {qrPattern.flat().map((filled, i) => (
            <div
              key={i}
              className={`h-2 w-2 ${filled ? "bg-zinc-50" : "bg-transparent"}`}
            />
          ))}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-zinc-500">Scan me</p>
          <p className="truncate text-sm font-medium text-zinc-50">
            links.acme.co/launch
          </p>
          <p className="mt-1 text-[10px] text-zinc-500">1,204 scans</p>
        </div>
      </div>
    </div>
  );
};

const SecurityMock = () => {
  const scans = [
    { label: "Phishing check", status: "clean" },
    { label: "Malware scan", status: "clean" },
    { label: "Reputation", status: "clean" },
    { label: "Redirect chain", status: "safe" },
  ];

  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/50 p-5">
      <div className="flex items-center gap-2">
        <IconShieldCheck size={16} className="text-emerald-400" />
        <p className="text-xs text-zinc-500">AI threat shield</p>
      </div>
      <p className="mt-3 font-heading text-xl font-bold text-zinc-50">
        All links clean
      </p>
      <p className="mt-1 text-xs text-zinc-500">
        Continuous scanning · updated 2s ago
      </p>
      <div className="mt-4 space-y-2">
        {scans.map((s) => (
          <div
            key={s.label}
            className="flex items-center justify-between rounded-lg border border-zinc-700/50 bg-zinc-900/60 px-3 py-2"
          >
            <span className="text-xs text-zinc-300">{s.label}</span>
            <span className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {s.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const GeoMock = () => {
  const rules = [
    { region: "US & Canada", dest: "/us-landing", flag: "US" },
    { region: "Europe", dest: "/eu-landing", flag: "EU" },
    { region: "Asia Pacific", dest: "/apac-landing", flag: "APAC" },
    { region: "Default", dest: "/global", flag: "*" },
  ];

  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/50 p-5">
      <div className="flex items-center gap-2">
        <IconRoute size={16} className="text-blue-400" />
        <p className="text-xs text-zinc-500">Geo-routing rules</p>
      </div>
      <div className="mt-4 space-y-2">
        {rules.map((r) => (
          <div
            key={r.region}
            className="flex items-center gap-3 rounded-lg border border-zinc-700/50 bg-zinc-900/60 px-3 py-2.5"
          >
            <span className="inline-flex h-6 w-10 shrink-0 items-center justify-center rounded border border-zinc-700 bg-zinc-800 text-[10px] font-medium text-zinc-400">
              {r.flag}
            </span>
            <span className="text-xs text-zinc-300">{r.region}</span>
            <IconArrowRight size={12} className="text-zinc-600" />
            <span className="truncate font-mono text-[11px] text-blue-400">
              {r.dest}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Two-column feature showcase
// ---------------------------------------------------------------------------

type Showcase = {
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
  visual: React.ReactNode;
  reverse?: boolean;
};

const Showcase = ({
  eyebrow,
  title,
  description,
  bullets,
  visual,
  reverse,
}: Showcase) => {
  return (
    <Reveal>
      <div className="grid items-center gap-8 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 md:grid-cols-2 md:p-10">
        <div className={reverse ? "md:order-2" : ""}>
          <p className="text-xs font-medium uppercase tracking-widest text-blue-400">
            {eyebrow}
          </p>
          <h3 className="mt-3 font-heading text-2xl font-bold text-zinc-50 md:text-3xl">
            {title}
          </h3>
          <p className="mt-3 leading-relaxed text-zinc-400">{description}</p>
          <ul className="mt-6 space-y-3">
            {bullets.map((text) => (
              <li key={text} className="flex items-start gap-3">
                <IconCheck
                  size={16}
                  className="mt-0.5 shrink-0 text-blue-400"
                />
                <span className="text-sm text-zinc-300">{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className={reverse ? "md:order-1" : ""}>{visual}</div>
      </div>
    </Reveal>
  );
};

// ---------------------------------------------------------------------------
// Small feature card
// ---------------------------------------------------------------------------

type SmallFeature = {
  icon: React.ComponentType<{ size?: number; stroke?: number; className?: string }>;
  title: string;
  description: string;
};

const SmallFeatureCard = ({
  feature,
  index,
}: {
  feature: SmallFeature;
  index: number;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  const Icon = feature.icon;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
      transition={{ duration: 0.4, delay: index * 0.06 }}
      className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-6 transition-colors hover:bg-zinc-900/60"
    >
      <Icon size={20} stroke={1.5} className="mb-4 text-zinc-400" />
      <p className="text-sm font-medium text-zinc-50">{feature.title}</p>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">
        {feature.description}
      </p>
    </motion.div>
  );
};

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const showcases: Showcase[] = [
  {
    eyebrow: "Analytics",
    title: "Know every click in real time",
    description:
      "Track every click with detailed analytics. See geographic data, device breakdowns, referrer sources, and click timing. Understand your audience and optimize your campaigns.",
    bullets: [
      "Real-time click tracking across all your links",
      "Geographic breakdown by country and city",
      "Device, browser, and OS detection",
      "Referrer source tracking to see where clicks originate",
      "Custom date ranges and exportable reports",
    ],
    visual: <AnalyticsMock />,
  },
  {
    eyebrow: "Branding",
    title: "Custom domains & QR codes",
    description:
      "Use your own domain for branded short links. Generate customizable QR codes tied to the same analytics — perfect for print, menus, and offline marketing.",
    bullets: [
      "Connect any custom domain with simple DNS setup",
      "SSL certificates provisioned automatically",
      "Multiple domains per account",
      "QR codes in PNG, SVG, and PDF formats",
      "Dynamic QR codes — update without reprinting",
    ],
    visual: <DomainQrMock />,
    reverse: true,
  },
  {
    eyebrow: "Security",
    title: "AI-powered threat protection",
    description:
      "Every link is scanned for phishing and malware using advanced AI detection. Keep your audience safe and your brand reputation intact — even after a link goes live.",
    bullets: [
      "Automatic phishing detection on every shortened URL",
      "AI-driven malware scanning for destination pages",
      "Real-time threat intelligence to block harmful links",
      "Flagged links quarantined and reviewed",
      "Continuous monitoring after link creation",
    ],
    visual: <SecurityMock />,
  },
  {
    eyebrow: "Targeting",
    title: "Route visitors by location",
    description:
      "Redirect users based on their geographic location. Show localized content to visitors in different countries or regions without maintaining separate links.",
    bullets: [
      "Set destination URLs per country or region",
      "Automatic detection of visitor location",
      "Fallback URL for unmatched locations",
      "Continent, country, and city-level rules",
      "Combine with analytics for geo performance insights",
    ],
    visual: <GeoMock />,
    reverse: true,
  },
];

const smallFeatures: SmallFeature[] = [
  {
    icon: IconBolt,
    title: "Lightning fast",
    description:
      "Sub-100ms redirects globally. Your links resolve before the blink of an eye.",
  },
  {
    icon: IconApi,
    title: "Developer API",
    description:
      "RESTful API with full documentation. Integrate link shortening into your stack.",
  },
  {
    icon: IconShieldLock,
    title: "Password protection",
    description:
      "Secure sensitive links with a password gate. Control exactly who gets through.",
  },
  {
    icon: IconFolders,
    title: "Link management",
    description:
      "Edit destinations, organize with folders, and keep your workspace tidy.",
  },
  {
    icon: IconClock,
    title: "Expiring links",
    description:
      "Set expiration dates or click limits. Links disable themselves automatically.",
  },
  {
    icon: IconUsers,
    title: "Team collaboration",
    description:
      "Shared workspaces, role-based access, and activity logs for every team member.",
  },
  {
    icon: IconLink,
    title: "Custom slugs",
    description:
      "Choose memorable, branded slugs or let us generate short ones for you.",
  },
  {
    icon: IconBrandGithub,
    title: "Webhooks",
    description:
      "Stream click events to your stack in real time for custom pipelines.",
  },
];

const comparisonRows: { feature: string; ishortn: boolean; typical: boolean }[] = [
  { feature: "Real-time click analytics", ishortn: true, typical: true },
  { feature: "Geographic & device breakdown", ishortn: true, typical: true },
  { feature: "Custom branded domains", ishortn: true, typical: false },
  { feature: "AI phishing & malware scanning", ishortn: true, typical: false },
  { feature: "Geo-targeted redirects", ishortn: true, typical: false },
  { feature: "Password-protected links", ishortn: true, typical: false },
  { feature: "Dynamic QR codes", ishortn: true, typical: false },
  { feature: "Developer API & webhooks", ishortn: true, typical: false },
  { feature: "Team workspaces", ishortn: true, typical: false },
  { feature: "Free tier with analytics", ishortn: true, typical: false },
];

// ---------------------------------------------------------------------------
// Page body
// ---------------------------------------------------------------------------

export const FeaturesClient = () => {
  return (
    <div className="bg-zinc-950">
      {/* Hero */}
      <section className="bg-zinc-950 px-6 pt-32 pb-20 md:pt-40 md:pb-28">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="text-xs font-medium uppercase tracking-widest text-blue-400">
              Features
            </p>
            <h1 className="mt-4 font-heading text-5xl font-extrabold leading-[1.05] tracking-tight text-zinc-50 md:text-6xl lg:text-[5.5rem]">
              Everything iShortn
              <br />
              can do for your links
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400 md:text-xl">
              From deep analytics to branded domains, AI security, and
              geo-routing — the full toolkit to shorten, share, and track every
              link you create.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                href={Paths.Login}
                className="group inline-flex items-center gap-2 rounded-full bg-blue-500 px-7 py-3.5 text-sm font-medium text-white transition-colors hover:bg-blue-600"
              >
                Start for free
                <IconArrowRight
                  size={15}
                  stroke={2}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </Link>
              <Link
                href="/#pricing"
                className="rounded-full border border-zinc-700 px-7 py-3.5 text-sm font-medium text-zinc-400 transition-all hover:border-zinc-500 hover:text-zinc-50"
              >
                View pricing
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Showcases */}
      <section className="bg-zinc-950 px-6 py-24 md:py-32">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="text-xs font-medium uppercase tracking-widest text-blue-400">
              Core capabilities
            </p>
            <h2 className="mt-3 font-heading text-4xl font-bold tracking-tight text-zinc-50 md:text-5xl">
              Built for serious link work
            </h2>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-zinc-400 md:text-xl">
              Four pillars that separate iShortn from a generic shortener.
            </p>
          </Reveal>

          <div className="mt-16 space-y-12">
            {showcases.map((s) => (
              <Showcase key={s.title} {...s} />
            ))}
          </div>
        </div>
      </section>

      {/* Small features grid */}
      <section className="bg-zinc-950 px-6 py-24 md:py-32">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="text-xs font-medium uppercase tracking-widest text-blue-400">
              And more
            </p>
            <h2 className="mt-3 font-heading text-4xl font-bold tracking-tight text-zinc-50 md:text-5xl">
              Everything else you need
            </h2>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-zinc-400 md:text-xl">
              Thoughtful details that add up to a better link management
              experience.
            </p>
          </Reveal>

          <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {smallFeatures.map((feature, index) => (
              <SmallFeatureCard
                key={feature.title}
                feature={feature}
                index={index}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Deep dive feature cluster — analytics detail */}
      <section className="bg-zinc-950 px-6 py-24 md:py-32">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="text-xs font-medium uppercase tracking-widest text-blue-400">
              Analytics, unpacked
            </p>
            <h2 className="mt-3 font-heading text-4xl font-bold tracking-tight text-zinc-50 md:text-5xl">
              The data layer behind every link
            </h2>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-zinc-400 md:text-xl">
              Every click becomes a data point. Slice it by geography, device,
              referrer, or time — then export it wherever you need.
            </p>
          </Reveal>

          <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              {
                icon: IconChartBar,
                title: "Click timing",
                body: "Trend analysis over any date range with hourly granularity.",
              },
              {
                icon: IconWorld,
                title: "Geography",
                body: "Country, region, and city-level breakdowns for every link.",
              },
              {
                icon: IconDeviceAnalytics,
                title: "Devices",
                body: "Desktop, mobile, tablet, plus browser and operating system.",
              },
              {
                icon: IconLink,
                title: "Referrers",
                body: "See exactly where clicks come from — social, email, direct.",
              },
              {
                icon: IconQrcode,
                title: "QR scans",
                body: "Offline scans tracked alongside online clicks in one view.",
              },
              {
                icon: IconSparkles,
                title: "Exports",
                body: "CSV and JSON exports for reporting, BI, and campaign reviews.",
              },
            ].map((item, i) => (
              <Reveal key={item.title} delay={i * 0.05}>
                <div className="h-full rounded-xl border border-zinc-800 bg-zinc-900/30 p-6 transition-colors hover:bg-zinc-900/60">
                  <item.icon
                    size={20}
                    stroke={1.5}
                    className="mb-4 text-zinc-400"
                  />
                  <p className="text-sm font-medium text-zinc-50">
                    {item.title}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                    {item.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison vs typical */}
      <section className="bg-zinc-950 px-6 py-24 md:py-32">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="text-xs font-medium uppercase tracking-widest text-blue-400">
              Compare
            </p>
            <h2 className="mt-3 font-heading text-4xl font-bold tracking-tight text-zinc-50 md:text-5xl">
              iShortn vs typical shorteners
            </h2>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-zinc-400 md:text-xl">
              Most short-link tools stop at redirects. iShortn ships the full
              stack — analytics, branding, security, and collaboration.
            </p>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="mt-14 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50">
              <div className="grid grid-cols-[1.6fr_1fr_1fr] items-center border-b border-zinc-800 px-6 py-4 text-xs font-medium uppercase tracking-widest text-zinc-500">
                <span>Feature</span>
                <span className="text-center text-blue-400">iShortn</span>
                <span className="text-center">Typical</span>
              </div>
              {comparisonRows.map((row, i) => (
                <div
                  key={row.feature}
                  className={`grid grid-cols-[1.6fr_1fr_1fr] items-center px-6 py-4 text-sm ${
                    i < comparisonRows.length - 1
                      ? "border-b border-zinc-800/60"
                      : ""
                  }`}
                >
                  <span className="text-zinc-300">{row.feature}</span>
                  <span className="flex justify-center">
                    {row.ishortn ? (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/15 text-blue-400">
                        <IconCheck size={14} stroke={2.5} />
                      </span>
                    ) : (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-zinc-600">
                        <IconX size={14} stroke={2.5} />
                      </span>
                    )}
                  </span>
                  <span className="flex justify-center">
                    {row.typical ? (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-zinc-400">
                        <IconCheck size={14} stroke={2.5} />
                      </span>
                    ) : (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-zinc-600">
                        <IconX size={14} stroke={2.5} />
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Developer + team combo showcase */}
      <section className="bg-zinc-950 px-6 py-24 md:py-32">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Reveal>
              <div className="h-full rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 md:p-10">
                <IconApi
                  size={24}
                  stroke={1.5}
                  className="mb-5 text-blue-400"
                />
                <h3 className="font-heading text-2xl font-bold text-zinc-50 md:text-3xl">
                  Developer API
                </h3>
                <p className="mt-3 leading-relaxed text-zinc-400">
                  Integrate link shortening into your apps with a RESTful API.
                  Create links, retrieve analytics, and manage your account
                  programmatically.
                </p>
                <ul className="mt-6 space-y-3">
                  {[
                    "RESTful API with comprehensive documentation",
                    "Create, update, and delete links programmatically",
                    "Retrieve detailed analytics via API endpoints",
                    "Scoped API keys with permissioned access",
                    "Webhooks for real-time event notifications",
                  ].map((b) => (
                    <li key={b} className="flex items-start gap-3">
                      <IconCheck
                        size={16}
                        className="mt-0.5 shrink-0 text-blue-400"
                      />
                      <span className="text-sm text-zinc-300">{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <div className="h-full rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 md:p-10">
                <IconUsers
                  size={24}
                  stroke={1.5}
                  className="mb-5 text-blue-400"
                />
                <h3 className="font-heading text-2xl font-bold text-zinc-50 md:text-3xl">
                  Team collaboration
                </h3>
                <p className="mt-3 leading-relaxed text-zinc-400">
                  Work together from a single dashboard. Share links, manage
                  permissions, and collaborate on campaigns with your whole
                  team.
                </p>
                <ul className="mt-6 space-y-3">
                  {[
                    "Invite team members to your workspace",
                    "Role-based access with admin and member roles",
                    "Shared link libraries across the team",
                    "Activity logs to track edits and creations",
                    "Centralized billing and subscription management",
                  ].map((b) => (
                    <li key={b} className="flex items-start gap-3">
                      <IconCheck
                        size={16}
                        className="mt-0.5 shrink-0 text-blue-400"
                      />
                      <span className="text-sm text-zinc-300">{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>

          {/* Password protection highlight */}
          <Reveal delay={0.1}>
            <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 md:p-10">
              <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
                <div className="max-w-2xl">
                  <div className="flex items-center gap-3">
                    <IconLockAccess
                      size={22}
                      stroke={1.5}
                      className="text-blue-400"
                    />
                    <h3 className="font-heading text-2xl font-bold text-zinc-50 md:text-3xl">
                      Password protection
                    </h3>
                  </div>
                  <p className="mt-3 leading-relaxed text-zinc-400">
                    Secure sensitive links with a password. Share confidential
                    documents safely, keep analytics intact, and change or
                    remove protection any time.
                  </p>
                </div>
                <Link
                  href={Paths.Login}
                  className="group inline-flex shrink-0 items-center gap-2 rounded-full border border-zinc-700 px-6 py-3 text-sm font-medium text-zinc-300 transition-all hover:border-zinc-500 hover:text-zinc-50"
                >
                  Try it free
                  <IconArrowRight
                    size={14}
                    stroke={2}
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-zinc-950 px-6 py-24 md:py-32">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 px-8 py-16 text-center md:px-16 md:py-20">
              <h2 className="font-heading text-3xl font-bold tracking-tight text-zinc-50 md:text-4xl lg:text-5xl">
                Ready to shorten smarter?
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-lg text-zinc-400">
                Join thousands of teams using iShortn to build branded links,
                track every click, and grow with data.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href={Paths.Login}
                  className="group inline-flex items-center gap-2 rounded-full bg-blue-500 px-8 py-3.5 text-sm font-medium text-white transition-colors hover:bg-blue-600"
                >
                  Get started free
                  <IconArrowRight
                    size={16}
                    stroke={2}
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
                <Link
                  href="/#pricing"
                  className="rounded-full border border-zinc-700 px-8 py-3.5 text-sm font-medium text-zinc-400 transition-all hover:border-zinc-500 hover:text-zinc-50"
                >
                  See pricing
                </Link>
              </div>
              <p className="mt-6 text-xs text-zinc-500">
                No credit card required
              </p>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
};
