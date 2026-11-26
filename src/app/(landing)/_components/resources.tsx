import { Link } from "next-view-transitions";

import { getLivePosts } from "@/lib/blog";
import { homeGuideSlugs } from "@/lib/copy/landing-page";
import { cn } from "@/lib/utils";

import { SiteIcon } from "./site-icon";
import {
  bodyClass,
  ButtonLink,
  cardClass,
  Eyebrow,
  h3Class,
  IconPlate,
  Section,
  SectionHeading,
} from "./site-primitives";

import type { ReactNode } from "react";

const tools: { href: string; title: string; body: string; icon: ReactNode }[] = [
  {
    href: "/qr-code-generator",
    title: "QR code generator",
    body: "Make a QR code for any link and download it as a PNG or SVG.",
    icon: <SiteIcon name="qrcode" />,
  },
  {
    href: "/utm-builder",
    title: "UTM builder",
    body: "Tag a link so Google Analytics shows which post, email or ad sent each visit.",
    icon: <SiteIcon name="tag-filled" />,
  },
  {
    href: "/whatsapp-link-generator",
    title: "WhatsApp link generator",
    body: "Make a wa.me link with your message already typed in, plus a QR code to print.",
    icon: <SiteIcon name="message-circle-filled" />,
  },
  {
    href: "/url-expander",
    title: "URL expander",
    body: "See every redirect and the final page behind a short link, with a safety check.",
    icon: <SiteIcon name="link" />,
  },
];

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900";

export const FreeTools = () => (
  <Section id="tools">
    <SectionHeading
      eyebrow={<Eyebrow icon={<SiteIcon name="apps-filled" />}>Free tools</Eyebrow>}
      title="Free tools, no account needed"
      subtitle="Use them as often as you like. Sign up when you want to track clicks."
    />
    <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {tools.map((tool) => (
        <li key={tool.href} className="flex">
          <Link
            href={tool.href}
            className={cn(cardClass, "flex w-full flex-col p-6 hover:bg-neutral-50", focusRing)}
          >
            <IconPlate>{tool.icon}</IconPlate>
            <h3 className={cn(h3Class, "mt-6 text-balance")}>{tool.title}</h3>
            <p className={cn(bodyClass, "mt-2")}>{tool.body}</p>
            <span className="mt-auto inline-flex items-center gap-1 pt-6 text-sm font-medium text-neutral-900">
              Open tool
              <SiteIcon name="chevron-right" className="size-4 shrink-0 opacity-70" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  </Section>
);

// Reads the clock, so the page using it must revalidate for a scheduled post to appear on its day.
export const Guides = ({ now }: { now?: Date }) => {
  const posts = getLivePosts(homeGuideSlugs, now);
  return (
    <Section id="guides">
      <SectionHeading
        align="left"
        eyebrow={<Eyebrow icon={<SiteIcon name="book-filled" />}>Guides</Eyebrow>}
        title="Guides to short links and QR codes"
        subtitle="How to shorten, track and share links, from the iShortn blog."
        actions={
          <ButtonLink variant="secondary" href="/blog">
            All guides
          </ButtonLink>
        }
      />
      {posts.length > 0 && (
        <ul className="mt-14 grid md:grid-cols-2 md:gap-x-8">
          {posts.map((post) => (
            <li
              key={post.slug}
              className="border-b border-neutral-950/[0.07] first:border-t md:[&:nth-child(2)]:border-t"
            >
              <Link
                href={`/blog/${post.slug}`}
                className={cn(
                  "group flex items-center justify-between gap-6 rounded-sm py-6",
                  focusRing,
                )}
              >
                <span className="text-pretty font-title text-lg font-semibold tracking-[-0.01em] text-neutral-900 underline decoration-transparent underline-offset-4 group-hover:decoration-neutral-900">
                  {post.title}
                </span>
                <SiteIcon name="chevron-right" className="size-5 shrink-0 text-neutral-600" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
};
