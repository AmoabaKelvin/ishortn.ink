import { IconSparklesFilled } from "@tabler/icons-react";
import { Link } from "next-view-transitions";

import { JsonLd } from "@/components/seo/json-ld";
import { Paths } from "@/lib/constants/app";
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
  leadClass,
  Section,
} from "../_components/site-primitives";
import { UrlExpander } from "./url-expander";

import type { Metadata } from "next";

const description =
  "Paste a short link from Bitly, TinyURL or any shortener and see every redirect and the final page before you click, with a Google Safe Browsing check. Free.";

// Hourly, so the related blog post list follows its publish date.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "URL Expander: See Where a Short Link Goes",
  description,
  keywords: [
    "url expander",
    "link expander",
    "unshorten url",
    "short link checker",
    "where does this link go",
    "link checker",
  ],
  alternates: { canonical: "/url-expander" },
  openGraph: {
    title: "URL Expander: See Where a Short Link Goes | iShortn",
    description,
    type: "website",
    url: "/url-expander",
  },
};

const inlineLink =
  "font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-4 hover:decoration-neutral-900";

const expanderFaqs = [
  {
    q: "Can I expand a Bitly or TinyURL link?",
    a: "Yes. The expander works with any shortener that uses a normal HTTP redirect, including Bitly, TinyURL, Rebrandly, Short.io, Dub, t.co and ishortn.ink.",
  },
  {
    q: "Does expanding a link count as a click?",
    a: "On iShortn links, no: we read the destination from our own database and don't record a visit. Other shorteners may count the request, because the expander has to ask their server where the link goes.",
  },
  {
    q: "Why does the link go somewhere different on my phone?",
    a: "Some short links send phones, countries or languages to different pages. The expander shows the route it got from our server, without a phone's user agent.",
  },
  {
    q: "Is there a quicker way for iShortn links?",
    a: "Yes. Add ! to the end of any iShortn short link, such as isht.app/spring-sale!, to see its destination without being redirected.",
    body: (
      <>
        Yes. Add <code className="font-mono text-neutral-900">!</code> to the end of any iShortn
        short link, such as{" "}
        <code className="font-mono text-neutral-900">isht.app/spring-sale!</code>, to see its
        destination without being redirected.
      </>
    ),
  },
  {
    q: "How do I report a dangerous iShortn link?",
    a: "Use the abuse report form at https://ishortn.ink/abuse. We review reports and block phishing and malware links.",
    body: (
      <>
        Use the{" "}
        <Link href="/abuse" className={inlineLink}>
          abuse report form
        </Link>
        . We review reports and block phishing and malware links.
      </>
    ),
  },
];

export default function UrlExpanderPage() {
  return (
    <main>
      <JsonLd
        data={createBreadcrumbSchema([
          { name: "Home", url: "https://ishortn.ink" },
          { name: "URL Expander", url: "https://ishortn.ink/url-expander" },
        ])}
      />
      <JsonLd data={createFaqSchema(expanderFaqs.map((f) => ({ question: f.q, answer: f.a })))} />
      <JsonLd
        data={createWebApplicationSchema({
          name: "iShortn URL Expander",
          url: "https://ishortn.ink/url-expander",
          description,
          applicationCategory: "UtilitiesApplication",
        })}
      />
      <Header />

      {/* Hero + expander */}
      <Section className="py-16 sm:py-24">
        <div className="flex flex-col items-center text-center">
          <Eyebrow icon={<IconSparklesFilled aria-hidden="true" />}>Free tool</Eyebrow>
          <h1 className={cn(h1Class, "mt-5 max-w-[20ch]")}>URL expander</h1>
          <p className={cn(leadClass, "mt-5 max-w-[52ch]")}>
            Paste a short link to see where it really goes. We follow each redirect for you and
            check the final address with Google Safe Browsing, so you never have to open it to find
            out.
          </p>
        </div>
        <div className="mt-12 sm:mt-14">
          <UrlExpander />
        </div>
      </Section>

      {/* How it works + safety */}
      <Section>
        <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-2">
          <div className={cn(cardClass, "p-6 sm:p-8")}>
            <h2 className={h3Class}>How it works</h2>
            <p className={cn(bodyClass, "mt-3")}>
              Short links hide the real address until you open them. The expander asks the short
              link&apos;s server where it points, follows each redirect up to 10 hops, and shows you
              every step and the final page. It never opens the page in your browser.
            </p>
          </div>
          <div className={cn(cardClass, "p-6 sm:p-8")}>
            <h2 className={h3Class}>Is this short link safe?</h2>
            <p className={cn(bodyClass, "mt-3")}>
              The final address is checked against Google Safe Browsing, which lists known phishing
              and malware sites. &ldquo;No known threats&rdquo; means the address isn&apos;t on that
              list yet, not that it&apos;s safe: new scam pages appear every day. Look at the final
              domain. If it imitates a bank, a delivery company or a login page and you weren&apos;t
              expecting the message, don&apos;t open it.
            </p>
          </div>
        </div>
        <div className="mx-auto mt-8 flex max-w-5xl flex-wrap items-center justify-center gap-3">
          <ButtonLink variant="soft" href="/qr-code-generator">
            QR code generator
          </ButtonLink>
          <ButtonLink variant="soft" href="/utm-builder">
            UTM builder
          </ButtonLink>
          <ButtonLink variant="soft" href="/abuse">
            Report a dangerous link
          </ButtonLink>
        </div>
      </Section>

      <Faq
        faqs={expanderFaqs}
        title="Quick answers"
        subtitle="About expanding links and what the safety check means."
      />

      <RelatedReading links={livePostLinks(["what-is-a-url-shortener"])} />

      <CTA
        title="Make short links people can trust"
        body="Anyone can add ! to the end of an iShortn link to see where it goes without opening it, and every new link is checked for phishing when it's created."
        primaryHref={Paths.Signup}
        primaryLabel="Create a free account"
      />
      <Footer />
    </main>
  );
}
