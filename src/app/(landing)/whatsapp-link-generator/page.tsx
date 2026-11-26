import {
  IconBasketFilled,
  IconBulbFilled,
  IconChartAreaLineFilled,
  IconEditFilled,
  IconLinkFilled,
  IconMessageCircleFilled,
  IconQrcode,
  IconSparklesFilled,
  IconToolsKitchen2Filled,
  IconUserFilled,
  IconWorldFilled,
} from "@tabler/icons-react";
import { Link } from "next-view-transitions";

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
  leadClass,
  Section,
  SectionHeading,
  StepChip,
} from "../_components/site-primitives";
import { IconCardGrid } from "./icon-card-grid";
import { FEATURES_SIGNUP_HREF } from "./utils";
import { WhatsAppLinkGenerator } from "./whatsapp-link-generator";

import type { IconCard } from "./icon-card-grid";
import type { Metadata } from "next";

const description =
  "Create a WhatsApp click-to-chat link with a pre-filled message, plus a QR code (PNG or SVG). Free, in your browser, no sign-up. Then track clicks with iShortn.";

// Hourly, so a related blog post scheduled for a future date shows up on that day.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "WhatsApp Link Generator with Message and QR Code",
  description,
  keywords: [
    "whatsapp link generator",
    "wa.me link generator",
    "whatsapp link with message",
    "whatsapp qr code generator",
    "whatsapp click to chat link",
    "create whatsapp link",
  ],
  alternates: {
    canonical: "/whatsapp-link-generator",
    languages: {
      en: "/whatsapp-link-generator",
      "pt-BR": "/gerador-de-link-whatsapp",
      "x-default": "/whatsapp-link-generator",
    },
  },
  openGraph: {
    title: "Free WhatsApp Link Generator | iShortn",
    description,
    type: "website",
    url: "/whatsapp-link-generator",
  },
};

const steps: { title: string; body: string }[] = [
  {
    title: "Add your number",
    body: "Pick your country and type your WhatsApp number. The link needs the full international number, so we add the country code and drop the leading 0.",
  },
  {
    title: "Write the first message",
    body: "Add the words you want customers to start with, like an order or a booking request. They can change it before they send.",
  },
  {
    title: "Share the link or print the code",
    body: "Put the link in your Instagram bio, Google Business Profile or emails. Download the QR code for menus, flyers, packaging and the counter.",
  },
];

const ideas: IconCard[] = [
  {
    title: "Menus and tables",
    body: "A code on the menu or table tent lets guests order, book or ask about allergens without calling.",
    icon: <IconToolsKitchen2Filled aria-hidden="true" />,
  },
  {
    title: "Instagram and TikTok bio",
    body: "Put the link in your bio so followers can message you with one tap, with the product name already in the message.",
    icon: <IconUserFilled aria-hidden="true" />,
  },
  {
    title: "Google Business Profile and website",
    body: "Add it as your chat button so people who find you on Maps can message instead of phone.",
    icon: <IconWorldFilled aria-hidden="true" />,
  },
  {
    title: "Packaging and receipts",
    body: "A code on the bag or receipt brings people back for a reorder or a question.",
    icon: <IconBasketFilled aria-hidden="true" />,
  },
];

const shortLinkFeatures: IconCard[] = [
  {
    title: "Change the number later",
    body: "Point the short link or QR code at a new number or message without reprinting anything.",
    icon: <IconEditFilled aria-hidden="true" />,
  },
  {
    title: "Count taps and scans",
    body: `See clicks by day, country, device and referrer. The Free plan shows the last ${PLAN_CAPS.free.analyticsRangeLimitDays} days.`,
    icon: <IconChartAreaLineFilled aria-hidden="true" />,
  },
  {
    title: "Use your own domain",
    body: "On Pro, links look like chat.yourshop.com/order instead of a long wa.me address.",
    icon: <IconWorldFilled aria-hidden="true" />,
  },
  {
    title: "Dynamic QR codes, free",
    body: `Free includes ${FREE_QR_CODE_LIMIT} dynamic QR codes, and they never expire.`,
    icon: <IconQrcode aria-hidden="true" />,
  },
];

const whatsappFaqs = [
  {
    q: "How do I create a WhatsApp link?",
    a: "Enter your number with its country code and, if you like, a message. The generator builds a link like https://wa.me/447700900123?text=Hi. Anyone who taps it opens a chat with you, on their phone or on WhatsApp Web.",
  },
  {
    q: "What is the wa.me link format?",
    a: "It's https://wa.me/ followed by your full international number, digits only: no plus sign, no spaces or dashes, and no leading 0. To pre-fill a message, add ?text= and the message, URL-encoded. The generator does both for you.",
  },
  {
    q: "How do I add a message to a WhatsApp link?",
    a: "Type it in the Message box. The generator encodes spaces, line breaks and emoji so they arrive as you wrote them. The person sees the message typed in and can edit it before sending.",
  },
  {
    q: "Do I need WhatsApp Business?",
    a: "No. Click-to-chat links work with personal WhatsApp and WhatsApp Business accounts. The WhatsApp Business app also has its own short link and QR code under Tools, with one pre-filled message. Use this generator if you have a personal account, want a different message for each place you share the link, or need an SVG file for print.",
  },
  {
    q: "Why does my link say the number isn't on WhatsApp?",
    a: "Usually the number is missing its country code or still has the leading 0 of the local format. Check the number shown under the field, which should be your full number starting with + and the country code. Make sure that number is registered on WhatsApp.",
  },
  {
    q: "Can I change the number on a printed QR code?",
    a: "Not on a code from this page, because the number and message are built into the pattern. If you shorten the link with iShortn first and print that code, you can change where it goes at any time and the printed code keeps working.",
  },
  {
    q: "Can I see how many people clicked my WhatsApp link?",
    a: "WhatsApp doesn't report link clicks. Shorten the link with iShortn and you get click counts by day, country and device, on the Free plan too.",
  },
  {
    q: "Is a wa.me link safe to open?",
    a: "A real wa.me link only opens a chat. Nothing is sent until you press send, and the message can be edited first. Scams tend to use lookalike addresses such as wa-me or whatsap, so check that the link goes to wa.me itself.",
  },
  {
    q: "How do I add a WhatsApp link to my Google Business Profile?",
    a: "Copy the wa.me link from this page and add it as the WhatsApp link in your profile's social profiles section. Use the link without a message if you want people to write their own.",
  },
  {
    q: "Why won't WhatsApp scan my QR code?",
    a: "The scanner inside WhatsApp only reads WhatsApp's own codes. Open your phone's camera app or a QR scanner instead, and the code opens the chat.",
  },
  {
    q: "Is anything I type stored?",
    a: "No. The generator runs in your browser, and your number and message aren't sent to our servers unless you choose to shorten the link.",
  },
];

export default function WhatsAppLinkGeneratorPage() {
  return (
    <main>
      <JsonLd
        data={createBreadcrumbSchema([
          { name: "Home", url: "https://ishortn.ink" },
          { name: "WhatsApp Link Generator", url: "https://ishortn.ink/whatsapp-link-generator" },
        ])}
      />
      <JsonLd data={createFaqSchema(whatsappFaqs.map((f) => ({ question: f.q, answer: f.a })))} />
      <JsonLd
        data={createWebApplicationSchema({
          name: "WhatsApp Link Generator",
          url: "https://ishortn.ink/whatsapp-link-generator",
          description,
        })}
      />
      <Header />

      {/* Hero + generator */}
      <Section className="py-16 sm:py-24">
        <div className="flex flex-col items-center text-center">
          <Eyebrow icon={<IconMessageCircleFilled aria-hidden="true" />}>
            WhatsApp link generator
          </Eyebrow>
          <h1 className={cn(h1Class, "mt-5 max-w-[20ch]")}>Free WhatsApp link generator</h1>
          <p className={cn(leadClass, "mt-5 max-w-[52ch]")}>
            Make a wa.me link with your message already typed in, plus a QR code to print. It runs
            in your browser, and you don&apos;t need an account.
          </p>
        </div>
        <div className="mt-12 sm:mt-14">
          <WhatsAppLinkGenerator />
          <p className="mx-auto mt-4 max-w-4xl text-pretty text-center text-sm text-neutral-600">
            WhatsApp is a trademark of WhatsApp LLC. iShortn isn&apos;t affiliated with or endorsed
            by WhatsApp or Meta.
          </p>
          <p className="mx-auto mt-2 max-w-4xl text-center text-sm text-neutral-600">
            <Link
              href="/gerador-de-link-whatsapp"
              hrefLang="pt-BR"
              lang="pt-BR"
              className="underline decoration-neutral-300 underline-offset-4 hover:text-neutral-900 hover:decoration-neutral-900"
            >
              Em português
            </Link>
          </p>
        </div>
      </Section>

      {/* How to */}
      <Section>
        <SectionHeading
          eyebrow={<Eyebrow icon={<IconBulbFilled aria-hidden="true" />}>How it works</Eyebrow>}
          title="How to make a WhatsApp link"
          subtitle="One link opens a chat with you, message ready to send."
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

      {/* Where to use it */}
      <Section>
        <SectionHeading
          eyebrow={<Eyebrow icon={<IconSparklesFilled aria-hidden="true" />}>Ideas</Eyebrow>}
          title="Where to put your WhatsApp link"
        />
        <IconCardGrid items={ideas} />
      </Section>

      {/* Shorten with iShortn */}
      <Section>
        <SectionHeading
          eyebrow={<Eyebrow icon={<IconLinkFilled aria-hidden="true" />}>Short links</Eyebrow>}
          title="Turn it into a link you can track and change"
          subtitle="WhatsApp doesn't tell you how many people tapped your link. iShortn does."
          actions={
            <>
              <ButtonLink href={FEATURES_SIGNUP_HREF}>Start free</ButtonLink>
              <ButtonLink variant="soft" href="/pricing">
                View pricing
              </ButtonLink>
            </>
          }
        />
        <IconCardGrid items={shortLinkFeatures} />
      </Section>

      <Faq faqs={whatsappFaqs} />

      <RelatedReading links={livePostLinks(["whatsapp-link-with-message"])} />

      <CTA />
      <Footer />
    </main>
  );
}
