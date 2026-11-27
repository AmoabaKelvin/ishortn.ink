import {
  IconChartAreaLineFilled,
  IconLinkFilled,
  IconQrcode,
  IconSparklesFilled,
  IconTableFilled,
  IconTagFilled,
  IconBulbFilled,
} from "@tabler/icons-react";

import { JsonLd } from "@/components/seo/json-ld";
import { FREE_QR_CODE_LIMIT } from "@/lib/billing/entitlements";
import { PLAN_CAPS } from "@/lib/billing/plans";
import { livePostLinks } from "@/lib/seo/related-links";
import {
  createBreadcrumbSchema,
  createFaqSchema,
  createWebApplicationSchema,
} from "@/lib/seo/structured-data";
import { cn } from "@/lib/utils";

import { CTA } from "../_components/cta";
import { Faq } from "../_components/faq";
import { Footer } from "../_components/footer";
import { Header } from "../_components/header";
import { RelatedReading } from "../_components/related-reading";
import {
  bodyClass,
  ButtonLink,
  cardClass,
  Eyebrow,
  h1Class,
  h3Class,
  IconPlate,
  leadClass,
  Section,
  SectionHeading,
  StepChip,
} from "../_components/site-primitives";
import { FEATURES_SIGNUP_HREF } from "./utils";
import { UtmBuilder } from "./utm-builder";

import type { Metadata } from "next";
import type { ReactNode } from "react";

const description =
  "Build UTM-tagged campaign URLs for Google Analytics 4, one link or a thousand. Free, in your browser, no sign-up. Then shorten and track them with iShortn.";

// Hourly, so a related blog post scheduled for a future date shows up on that day.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Free UTM Builder: Campaign URL Builder for GA4",
  description,
  keywords: [
    "utm builder",
    "utm generator",
    "campaign url builder",
    "bulk utm builder",
    "utm link builder",
    "google analytics utm builder",
  ],
  alternates: { canonical: "/utm-builder" },
  openGraph: {
    title: "Free UTM Builder for Campaign URLs | iShortn",
    description,
    type: "website",
    url: "/utm-builder",
  },
};

const steps: { title: string; body: string }[] = [
  {
    title: "Paste your page URL",
    body: "Use the page you want people to land on. If the link already has UTM tags, the builder reads them into the fields.",
  },
  {
    title: "Fill in source, medium and campaign",
    body: "Pick a quick-fill channel or type your own values. Spell them the same way every time, because GA4 counts Facebook and facebook as two sources.",
  },
  {
    title: "Copy the link or shorten it",
    body: "Use the tagged link in your post, email or ad. Visits show up in GA4 under Reports, Acquisition, Traffic acquisition.",
  },
];

const parameters: { name: string; meaning: string; examples: string }[] = [
  { name: "utm_source", meaning: "Who sent the visit", examples: "newsletter, instagram, google" },
  { name: "utm_medium", meaning: "The type of channel", examples: "email, social, cpc, print" },
  {
    name: "utm_campaign",
    meaning: "The promotion or launch",
    examples: "black_friday_2026, spring_launch",
  },
  {
    name: "utm_content",
    meaning: "Which link or version was clicked",
    examples: "header_button, story_2",
  },
  { name: "utm_term", meaning: "The paid search keyword", examples: "running_shoes" },
  {
    name: "utm_id",
    meaning: "A campaign ID for matching with ad or cost data",
    examples: "an ID from your ad platform",
  },
];

const shortLinkFeatures: { title: string; body: string; icon: ReactNode }[] = [
  {
    title: "Keeps your tags",
    body: "iShortn sends visitors to the exact URL you saved, UTM tags included.",
    icon: <IconLinkFilled aria-hidden="true" />,
  },
  {
    title: "Counts every click",
    body: `See clicks by day, country, device and referrer. The Free plan shows the last ${PLAN_CAPS.free.analyticsRangeLimitDays} days.`,
    icon: <IconChartAreaLineFilled aria-hidden="true" />,
  },
  {
    title: "Works as a QR code",
    body: `Turn the same link into a dynamic QR code for print. Free includes ${FREE_QR_CODE_LIMIT}, and they never expire.`,
    icon: <IconQrcode aria-hidden="true" />,
  },
  {
    title: "Keeps your naming consistent",
    body: "On Pro, the link editor has UTM fields and a campaign adds your source and medium to every link in it. Ultra adds saved templates.",
    icon: <IconTagFilled aria-hidden="true" />,
  },
];

const utmFaqs = [
  {
    q: "What is a UTM builder?",
    a: "A UTM builder adds tracking tags to the end of a URL, such as utm_source=newsletter. When someone clicks the link, Google Analytics and similar tools read the tags and report which source, channel and campaign sent the visit.",
  },
  {
    q: "Which UTM parameters do I need?",
    a: "Source is the one you can't skip. Add medium and campaign as well, because GA4 uses source and medium to sort visits into channels like Email or Paid Social. Content, term and campaign ID are optional.",
  },
  {
    q: "Do UTM values have to be lowercase?",
    a: "No, but GA4 treats values as case-sensitive, so Facebook and facebook show up as separate rows. Lowercase with underscores is the easiest rule to stick to. The Clean up values option does it for you.",
  },
  {
    q: "Is anything I type stored?",
    a: "No. The builder runs in your browser. Your URLs and tags stay there unless you choose to shorten a link, and you don't need an account.",
  },
  {
    q: "Do UTM tags still work if I shorten the link?",
    a: "Yes. Shorten the full tagged URL and the short link redirects to it with every tag in place, so GA4 records the campaign as usual. In iShortn this works on every plan, including Free, and you also get click counts for the short link.",
  },
  {
    q: "Can I tag many links at once?",
    a: "Yes. Switch to Many links, paste up to 1,000 URLs and apply the same tags to all of them. You can copy the results or download a CSV that imports straight into iShortn on the Pro plan and up.",
  },
];

export default function UtmBuilderPage() {
  return (
    <main>
      <JsonLd
        data={createBreadcrumbSchema([
          { name: "Home", url: "https://ishortn.ink" },
          { name: "UTM Builder", url: "https://ishortn.ink/utm-builder" },
        ])}
      />
      <JsonLd data={createFaqSchema(utmFaqs.map((f) => ({ question: f.q, answer: f.a })))} />
      <JsonLd
        data={createWebApplicationSchema({
          name: "UTM Builder",
          url: "https://ishortn.ink/utm-builder",
          description,
        })}
      />
      <Header />

      {/* Hero + builder */}
      <Section className="py-16 sm:py-24">
        <div className="flex flex-col items-center text-center">
          <Eyebrow icon={<IconSparklesFilled aria-hidden="true" />}>UTM builder</Eyebrow>
          <h1 className={cn(h1Class, "mt-5 max-w-[20ch]")}>Free UTM builder for campaign links</h1>
          <p className={cn(leadClass, "mt-5 max-w-[52ch]")}>
            Add UTM tags to any link so Google Analytics shows which post, email or ad sent each
            visitor. It runs in your browser, and you don&apos;t need an account.
          </p>
        </div>
        <div className="mt-12 sm:mt-14">
          <UtmBuilder />
        </div>
      </Section>

      {/* How to */}
      <Section>
        <SectionHeading
          eyebrow={<Eyebrow icon={<IconBulbFilled aria-hidden="true" />}>How it works</Eyebrow>}
          title="How to build a UTM link"
          subtitle="Three fields cover most campaigns."
        />
        <ol className="mx-auto mt-14 grid max-w-5xl gap-4 md:grid-cols-3">
          {steps.map((step, i) => (
            <li key={step.title} className={cn(cardClass, "p-6 sm:p-8")}>
              <StepChip>{String(i + 1).padStart(2, "0")}</StepChip>
              <h3 className={cn(h3Class, "mt-6")}>{step.title}</h3>
              <p className={cn(bodyClass, "mt-2 sm:text-sm")}>{step.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* Parameter reference */}
      <Section>
        <SectionHeading
          eyebrow={<Eyebrow icon={<IconTableFilled aria-hidden="true" />}>Parameters</Eyebrow>}
          title="What each UTM parameter does"
        />
        <div className="mx-auto mt-14 max-w-4xl">
          <div className={cn(cardClass, "overflow-x-auto")}>
            <table className="w-full min-w-[36rem] text-left text-base sm:text-sm">
              <thead className="text-neutral-900">
                <tr className="border-b border-neutral-950/[0.07]">
                  <th scope="col" className="px-5 py-4 font-medium sm:px-6">
                    Parameter
                  </th>
                  <th scope="col" className="px-5 py-4 font-medium sm:px-6">
                    What it tells you
                  </th>
                  <th scope="col" className="px-5 py-4 font-medium sm:px-6">
                    Examples
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-950/[0.07] text-neutral-600">
                {parameters.map((param) => (
                  <tr key={param.name}>
                    <th scope="row" className="px-5 py-4 font-normal sm:px-6">
                      <code className="font-mono text-sm text-neutral-900">{param.name}</code>
                    </th>
                    <td className="px-5 py-4 sm:px-6">{param.meaning}</td>
                    <td className="px-5 py-4 sm:px-6">{param.examples}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={cn(bodyClass, "mt-6")}>
            Don&apos;t add UTM tags to links between pages of your own site. GA4 starts a new
            session from the tagged click and credits the visit to that tag instead of where the
            visitor really came from.
          </p>
        </div>
      </Section>

      {/* Shorten with iShortn */}
      <Section>
        <SectionHeading
          eyebrow={<Eyebrow icon={<IconLinkFilled aria-hidden="true" />}>Short links</Eyebrow>}
          title="Shorten tagged links with iShortn"
          subtitle="A short link redirects to your full tagged URL, so GA4 still gets every tag."
          actions={
            <>
              <ButtonLink href={FEATURES_SIGNUP_HREF}>Start free</ButtonLink>
              <ButtonLink variant="soft" href="/pricing">
                View pricing
              </ButtonLink>
            </>
          }
        />
        <dl className="mx-auto mt-14 grid max-w-4xl gap-4 sm:grid-cols-2">
          {shortLinkFeatures.map((item) => (
            <div key={item.title} className={cn(cardClass, "p-6 sm:p-8")}>
              <IconPlate>{item.icon}</IconPlate>
              <dt className={cn(h3Class, "mt-6")}>{item.title}</dt>
              <dd className={cn(bodyClass, "mt-2 sm:text-sm")}>{item.body}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Faq faqs={utmFaqs} />

      <RelatedReading
        links={livePostLinks(["how-to-track-link-clicks", "utm-naming-convention"])}
      />

      <CTA />
      <Footer />
    </main>
  );
}
