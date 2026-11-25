import {
  IconBrandChrome,
  IconClockFilled,
  IconCopyFilled,
  IconLinkFilled,
  IconPuzzleFilled,
  IconQrcode,
  IconSparklesFilled,
} from "@tabler/icons-react";

import { JsonLd } from "@/components/seo/json-ld";
import { PLAN_CAPS } from "@/lib/billing/plans";
import { CHROME_WEB_STORE_SITE_URL } from "@/lib/constants/extension";
import { createBreadcrumbSchema, createFaqSchema } from "@/lib/seo/structured-data";
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
  IconPlate,
  leadClass,
  Section,
  SectionHeading,
} from "../_components/site-primitives";

import type { Metadata } from "next";
import type { ReactNode } from "react";

const description =
  "Shorten the current tab in one click, copy the link and get its QR code with the free iShortn extension for Chrome and Edge.";

export const metadata: Metadata = {
  title: "Chrome Extension: Shorten Links and Make QR Codes",
  description,
  keywords: [
    "url shortener chrome extension",
    "link shortener extension",
    "qr code chrome extension",
    "shorten current tab",
    "ishortn extension",
  ],
  alternates: { canonical: "/extension" },
  openGraph: {
    title: "iShortn for Chrome | iShortn",
    description,
    type: "website",
    url: "/extension",
  },
};

// Also the social card's subtitle (og-cards.test.ts).
const lead =
  "Shorten the current tab in one click, copy the link and get its QR code, right from your browser toolbar.";

const docsHref = "/docs/integrations/browser-extension";

const features: { title: string; body: string; icon: ReactNode }[] = [
  {
    title: "Shorten the current tab",
    body: "Click the toolbar icon or press Alt+Shift+S, and the page you're on becomes a short link. Pick a custom alias or one of your domains if you want.",
    icon: <IconLinkFilled aria-hidden="true" />,
  },
  {
    title: "Copied for you",
    body: "The short link lands on your clipboard as soon as it's made, ready to paste into a chat, email or post.",
    icon: <IconCopyFilled aria-hidden="true" />,
  },
  {
    title: "QR code included",
    body: "Every link comes with a QR code you can download as a PNG. Even before you sign in, you get a QR code for the page you're on.",
    icon: <IconQrcode aria-hidden="true" />,
  },
  {
    title: "Your recent links",
    body: "Your five latest links sit in the popup with a copy button, so the one you made this morning is a click away.",
    icon: <IconClockFilled aria-hidden="true" />,
  },
];

const extensionFaqs = [
  {
    q: "Is the extension free?",
    a: `Yes. It works on every plan, including Free. Links you make with it count toward your monthly limit like links made in the dashboard: ${PLAN_CAPS.free.linksLimit} a month on Free.`,
  },
  {
    q: "Which browsers does it work in?",
    a: "Chrome and Microsoft Edge, both from the Chrome Web Store. A Firefox build is available from source; the setup guide explains how to load it.",
  },
  {
    q: "What can the extension see?",
    a: "Only the URL of the tab you're on, and only after you click the toolbar icon or press the shortcut. It has no access to page content, your other tabs or your browsing history.",
  },
  {
    q: "Where do the links go?",
    a: "Into your personal iShortn workspace, next to the links you make in the dashboard, with the same click analytics. You can disconnect a browser at any time from Settings.",
  },
];

export default function ExtensionPage() {
  return (
    <main>
      <JsonLd
        data={createBreadcrumbSchema([
          { name: "Home", url: "https://ishortn.ink" },
          { name: "Chrome extension", url: "https://ishortn.ink/extension" },
        ])}
      />
      <JsonLd data={createFaqSchema(extensionFaqs.map((f) => ({ question: f.q, answer: f.a })))} />
      <Header />

      {/* Hero */}
      <Section className="py-16 sm:py-24">
        <div className="flex flex-col items-center text-center">
          <Eyebrow icon={<IconPuzzleFilled aria-hidden="true" />}>Browser extension</Eyebrow>
          <h1 className={cn(h1Class, "mt-5 max-w-[20ch]")}>iShortn for Chrome</h1>
          <p className={cn(leadClass, "mt-5 max-w-[52ch]")}>{lead}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a
              href={CHROME_WEB_STORE_SITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonClass({ size: "lg" }), "gap-2")}
            >
              <IconBrandChrome aria-hidden="true" className="size-5 shrink-0" />
              Add to Chrome
            </a>
            <ButtonLink size="lg" variant="secondary" href={docsHref}>
              Setup guide
            </ButtonLink>
          </div>
          <p className="mt-4 text-sm text-neutral-600">Free. Works in Chrome and Edge.</p>
          <p className="mt-1 max-w-[52ch] text-sm text-neutral-600">
            On Edge, click &ldquo;Allow extensions from other stores&rdquo; when asked, then
            &ldquo;Add to Chrome&rdquo;.
          </p>
        </div>

        {/* The browser screenshot is unreadable at phone width, so phones get the popup alone. */}
        <picture
          className={cn(
            cardClass,
            "mx-auto mt-12 block max-w-sm overflow-hidden sm:mt-14 sm:max-w-5xl",
          )}
        >
          <source
            media="(min-width: 640px)"
            srcSet="/extension/shorten-and-copy.webp"
            width={1280}
            height={800}
          />
          {/* oxlint-disable-next-line nextjs/no-img-element -- static asset with fixed size; the Worker has no image optimizer */}
          <img
            src="/extension/popup.webp"
            alt="The iShortn popup with a new short link copied, its QR code and Download PNG and Copy link buttons"
            width={680}
            height={970}
            fetchPriority="high"
            className="block h-auto w-full"
          />
        </picture>
      </Section>

      {/* Features */}
      <Section>
        <SectionHeading
          eyebrow={<Eyebrow icon={<IconSparklesFilled aria-hidden="true" />}>What it does</Eyebrow>}
          title="Short links without leaving the page"
          subtitle="Everything happens in a small popup next to the address bar."
        />
        <dl className="mx-auto mt-14 grid max-w-4xl gap-4 sm:grid-cols-2">
          {features.map((item) => (
            <div key={item.title} className={cn(cardClass, "p-6 sm:p-8")}>
              <IconPlate>{item.icon}</IconPlate>
              <dt className={cn(h3Class, "mt-6")}>{item.title}</dt>
              <dd className={cn(bodyClass, "mt-2 sm:text-sm")}>{item.body}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Faq faqs={extensionFaqs} subtitle="About the iShortn browser extension." />

      <CTA
        title="Make your first short link"
        body="Create a free account, then connect the extension from its popup."
        primaryLabel="Create a free account"
      />
      <Footer />
    </main>
  );
}
