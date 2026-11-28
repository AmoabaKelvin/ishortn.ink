import { IconBrandGithubFilled, IconCodeCircle2Filled, IconScaleFilled } from "@tabler/icons-react";
import { Link } from "next-view-transitions";

import { JsonLd } from "@/components/seo/json-ld";
import { FREE_QR_CODE_LIMIT } from "@/lib/billing/entitlements";
import { PLAN_CAPS } from "@/lib/billing/plans";
import { Paths } from "@/lib/constants/app";
import { PLAN_PRICES_USD } from "@/lib/constants/plan-pricing";
import {
  createBreadcrumbSchema,
  createFaqSchema,
  formatCount,
  pluralize,
  softwareApplicationSchema,
} from "@/lib/seo/structured-data";
import { cn } from "@/lib/utils";

import { CTA } from "../_components/cta";
import { Faq } from "../_components/faq";
import { Footer } from "../_components/footer";
import { Header } from "../_components/header";
import {
  bodyClass,
  buttonClass,
  ButtonLink,
  cardClass,
  Eyebrow,
  h1Class,
  h3Class,
  leadClass,
  Section,
  SectionHeading,
} from "../_components/site-primitives";

import type { Metadata } from "next";
import type { ReactNode } from "react";

const PAGE_URL = "https://ishortn.ink/open-source-url-shortener";
const REPO_URL = "https://github.com/AmoabaKelvin/ishortn.ink";
const SELF_HOSTING_HREF = "/docs/self-hosting";
// Licences, stars and hosted plans of the other projects, from their repos and sites.
const CHECKED_ON = "2026-11-26";

const title = "Open-Source URL Shortener: Self-Host or Use It Free";
const description =
  "iShortn is an MIT-licensed URL shortener with analytics, custom domains and QR codes. Self-host it on Cloudflare Workers or use the free hosted plan.";

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    "open source url shortener",
    "self-hosted url shortener",
    "open source link shortener",
    "yourls alternative",
    "shlink alternative",
    "kutt alternative",
  ],
  alternates: { canonical: "/open-source-url-shortener" },
  openGraph: {
    title: `${title} | iShortn`,
    description,
    type: "website",
    url: "/open-source-url-shortener",
  },
};

// Also the social card's subtitle (og-cards.test.ts).
const lead =
  "iShortn is an MIT-licensed link shortener with click analytics, custom domains, dynamic QR codes and bio pages. Run it on your own Cloudflare account, or use the hosted version at ishortn.ink, which runs the same code and has a free plan.";

const { free, pro } = PLAN_CAPS;
const proPrice = PLAN_PRICES_USD.pro;

const textLinkClass =
  "font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-4 hover:decoration-neutral-900";

type Project = {
  name: string;
  href?: string;
  isOwn?: boolean;
  licence: ReactNode;
  stack: string;
  hosted: string;
  analytics: string;
  qrCodes: string;
  users: string;
};

const projects: Project[] = [
  {
    name: "iShortn",
    isOwn: true,
    licence: "MIT",
    stack: "TypeScript, Next.js on Cloudflare Workers, MySQL",
    hosted: `ishortn.ink (free plan; Pro $${proPrice}/mo)`,
    analytics: "Yes",
    qrCodes: "Yes, dynamic",
    users: "Accounts and team workspaces",
  },
  {
    name: "Dub",
    href: "/compare/dub",
    licence: (
      <>
        AGPLv3, with commercial-licence <code>ee</code> folders
      </>
    ),
    stack: "TypeScript, Next.js",
    // Same figures as /compare/dub (src/lib/seo/competitors.ts).
    hosted: "dub.co (free plan; Pro $30/mo)",
    analytics: "Yes",
    qrCodes: "Yes",
    users: "Yes, by plan",
  },
  {
    name: "YOURLS",
    licence: "MIT",
    stack: "PHP",
    hosted: "None official",
    analytics: "Yes",
    qrCodes: "Through plugins",
    users: "Several logins, shared links",
  },
  {
    name: "Kutt",
    licence: "MIT",
    stack: "Node.js",
    hosted: "kutt.to (free)",
    analytics: "Yes",
    qrCodes: "Yes",
    users: "Accounts and admin",
  },
  {
    name: "Shlink",
    licence: "MIT",
    stack: "PHP",
    hosted: "None (app.shlink.io is a web client for your own server)",
    analytics: "Yes",
    qrCodes: "Built in, deprecated since 4.5.0",
    users: "API keys with roles",
  },
  {
    name: "Sink",
    licence: "AGPL-3.0",
    stack: "TypeScript on Cloudflare",
    hosted: "None",
    analytics: "Yes",
    qrCodes: "Yes",
    users: "Single site token",
  },
];

const columns: { label: string; key: Exclude<keyof Project, "name" | "href" | "isOwn"> }[] = [
  { label: "Licence", key: "licence" },
  { label: "Stack", key: "stack" },
  { label: "Hosted version", key: "hosted" },
  { label: "Click analytics", key: "analytics" },
  { label: "QR codes", key: "qrCodes" },
  { label: "Users", key: "users" },
];

const picks: { name: string; who: string; pick: ReactNode }[] = [
  {
    name: "YOURLS",
    who: "You want a mature PHP shortener on shared hosting:",
    pick: "YOURLS. It has the largest plugin ecosystem.",
  },
  { name: "Shlink", who: "You want an API-first service for your own apps:", pick: "Shlink." },
  {
    name: "Dub",
    who: "You want a polished product with affiliate and partner features and can pay for the hosted plan:",
    pick: (
      <>
        Dub. Check the commercial licence on the <code>ee</code> folders before you self-host those
        parts.
      </>
    ),
  },
  {
    name: "Sink",
    who: "You want everything on Cloudflare with no database server:",
    pick: "Sink.",
  },
  {
    name: "iShortn",
    who: "You want a free hosted plan with analytics and dynamic QR codes, plus the option to self-host the same code on Cloudflare later:",
    pick: "iShortn.",
  },
];

const features = [
  "Short links on your own domain, with click analytics by country, city, device, browser and referrer",
  "Dynamic QR codes you can edit after printing, with colours, logos and SVG download",
  "Link-in-bio pages, password-protected and scheduled links, geo and device targeting",
  "Team workspaces, a REST API, CSV import and a browser extension for Chrome and Edge",
  "New links checked for phishing when they're created, and live links re-checked against phishing feeds",
];

const faqs = [
  {
    q: "Is iShortn really open source?",
    a: "Yes. The code is on GitHub under the MIT licence, and the hosted service at ishortn.ink deploys the same code.",
  },
  {
    q: "Is there a free open-source URL shortener I don't have to host?",
    a: `Yes. iShortn, Dub and Kutt all have free hosted versions. iShortn Free includes ${formatCount(free.linksLimit)} links a month with click stats and ${FREE_QR_CODE_LIMIT} dynamic QR codes.`,
  },
  {
    q: "Can I move from YOURLS or Bitly to iShortn?",
    a: "Yes. Export your links as a CSV, name the columns url, alias and domain, and upload them with CSV import on Pro. Links on your own domain keep their addresses once the domain points to iShortn. See the bulk import and moving from Bitly guides in the docs.",
  },
];

const checkedOnLabel = new Date(CHECKED_ON).toLocaleDateString("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export default function OpenSourceUrlShortenerPage() {
  return (
    <main>
      <JsonLd
        data={createBreadcrumbSchema([
          { name: "Home", url: "https://ishortn.ink" },
          { name: "Open-source URL shortener", url: PAGE_URL },
        ])}
      />
      <JsonLd
        data={{
          ...softwareApplicationSchema,
          license: "https://opensource.org/licenses/MIT",
          sameAs: [REPO_URL],
        }}
      />
      <JsonLd data={createFaqSchema(faqs.map((f) => ({ question: f.q, answer: f.a })))} />
      <Header />

      {/* Hero */}
      <Section className="py-16 sm:py-24">
        <div className="flex flex-col items-center text-center">
          <Eyebrow icon={<IconCodeCircle2Filled aria-hidden="true" />}>MIT licence</Eyebrow>
          <h1 className={cn(h1Class, "mt-5 max-w-[20ch]")}>Open-source URL shortener</h1>
          <p className={cn(leadClass, "mt-5 max-w-[60ch]")}>{lead}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonClass({ size: "lg" }), "gap-2")}
            >
              <IconBrandGithubFilled aria-hidden="true" className="size-5 shrink-0" />
              View the code on GitHub
            </a>
            <ButtonLink size="lg" variant="secondary" href={SELF_HOSTING_HREF}>
              Self-hosting guide
            </ButtonLink>
            <ButtonLink size="lg" variant="soft" href={Paths.Signup}>
              Use it free
            </ButtonLink>
          </div>
        </div>
      </Section>

      {/* Self-host or hosted */}
      <Section>
        <SectionHeading title="Self-host it or let us run it" />
        <div className="mx-auto mt-14 grid max-w-4xl gap-4 sm:grid-cols-2">
          <div className={cn(cardClass, "p-6 sm:p-8")}>
            <h3 className={h3Class}>Self-host</h3>
            <p className={cn(bodyClass, "mt-2 sm:text-sm")}>
              iShortn deploys as one Cloudflare Worker with a MySQL 8 database and Clerk for
              sign-in. The{" "}
              <Link href={SELF_HOSTING_HREF} className={textLinkClass}>
                self-hosting guide
              </Link>{" "}
              covers the resources, environment variables, database setup, cron jobs and upgrades.
              You need the Workers Paid plan, because the phishing rescan needs a higher CPU limit.
            </p>
          </div>
          <div className={cn(cardClass, "p-6 sm:p-8")}>
            <h3 className={h3Class}>Hosted</h3>
            <p className={cn(bodyClass, "mt-2 sm:text-sm")}>
              If you&apos;d rather not run a server, the hosted version at ishortn.ink has a free
              plan: {formatCount(free.linksLimit)} links a month, {formatCount(free.eventsLimit)}{" "}
              tracked clicks a month, {free.analyticsRangeLimitDays}-day analytics and{" "}
              {FREE_QR_CODE_LIMIT} dynamic QR codes that never expire. Pro is ${proPrice} a month
              and adds {pluralize(pro.domainLimit, "custom domain")} and the REST API. You can
              export your links as CSV or JSON on every plan, so you can move to your own instance
              later.
            </p>
          </div>
        </div>
      </Section>

      {/* Comparison */}
      <Section>
        <SectionHeading
          eyebrow={<Eyebrow icon={<IconScaleFilled aria-hidden="true" />}>Compare</Eyebrow>}
          title="Open-source URL shorteners compared"
          subtitle={`We make iShortn, so weigh our view accordingly. Licences come from each project's LICENSE file and star counts from GitHub, checked ${checkedOnLabel}.`}
        />
        <div className={cn(cardClass, "mt-14 overflow-x-auto")}>
          <table className="w-full border-collapse text-left text-base sm:text-sm">
            <caption className="sr-only">
              Open-source URL shorteners by licence, stack, hosted version, click analytics, QR
              codes and users, checked <time dateTime={CHECKED_ON}>{checkedOnLabel}</time>
            </caption>
            <thead>
              <tr className="border-b border-neutral-950/[0.07]">
                <th
                  scope="col"
                  className="sticky left-0 min-w-28 bg-white px-4 py-4 font-medium text-neutral-600 sm:px-5"
                >
                  Project
                </th>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className="min-w-40 px-4 py-4 font-medium text-neutral-600 sm:px-5"
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-950/[0.07]">
              {projects.map((project) => (
                <tr key={project.name}>
                  <th
                    scope="row"
                    className={cn(
                      "sticky left-0 px-4 py-4 align-top font-medium text-neutral-900 sm:px-5",
                      project.isOwn ? "bg-neutral-50" : "bg-white",
                    )}
                  >
                    {project.href ? (
                      <Link href={project.href} className={textLinkClass}>
                        {project.name}
                      </Link>
                    ) : (
                      project.name
                    )}
                  </th>
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        "px-4 py-4 align-top sm:px-5",
                        project.isOwn ? "bg-neutral-50 text-neutral-900" : "text-neutral-600",
                      )}
                    >
                      {project[column.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={cn(bodyClass, "mt-6 max-w-[70ch] sm:text-sm")}>
          About 25,000 GitHub stars for Dub, 12,000 for YOURLS, 11,000 for Kutt, 7,000 for Sink and
          5,000 for Shlink. iShortn is newer and smaller.
        </p>
      </Section>

      {/* Which one */}
      <Section>
        <SectionHeading align="left" title="Which one should you pick?" />
        <ul className="mt-10 max-w-[70ch] space-y-4">
          {picks.map((item) => (
            <li key={item.name} className={bodyClass}>
              <strong className="font-semibold text-neutral-900">{item.who}</strong> {item.pick}
            </li>
          ))}
        </ul>
      </Section>

      {/* Features */}
      <Section>
        <SectionHeading align="left" title="What's in iShortn" />
        <ul className="mt-10 max-w-[70ch] list-disc space-y-3 pl-5 marker:text-neutral-400">
          {features.map((feature) => (
            <li key={feature} className={bodyClass}>
              {feature}
            </li>
          ))}
        </ul>
        <p className={cn(bodyClass, "mt-8")}>
          See{" "}
          <Link href="/features" className={textLinkClass}>
            all features
          </Link>
          ,{" "}
          <Link href="/docs/bulk-import" className={textLinkClass}>
            bulk import
          </Link>{" "}
          and{" "}
          <Link href="/docs/migrate-from-bitly" className={textLinkClass}>
            moving from Bitly
          </Link>
          .
        </p>
      </Section>

      <Faq
        faqs={faqs}
        title="Quick answers"
        subtitle="About iShortn's licence, hosting and moving your links."
      />

      <CTA
        title="Try the hosted version free"
        body="Create a free account at ishortn.ink, or deploy your own instance from the repo."
        primaryLabel="Use it free"
      />
      <Footer />
    </main>
  );
}
