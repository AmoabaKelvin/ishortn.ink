import { Link } from "next-view-transitions";

import { solutionList } from "@/lib/seo/solutions";

import { SiteIcon, type SiteIconName } from "./site-icon";
import { Section, Wordmark } from "./site-primitives";

const columns: { title: string; links: { label: string; href: string; lang?: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/features" },
      { label: "QR code generator", href: "/qr-code-generator" },
      { label: "UTM builder", href: "/utm-builder" },
      { label: "Chrome extension", href: "/extension" },
      { label: "WhatsApp link generator", href: "/whatsapp-link-generator" },
      {
        label: "Gerador de link WhatsApp (PT-BR)",
        href: "/gerador-de-link-whatsapp",
        lang: "pt-BR",
      },
      { label: "Pricing", href: "/pricing" },
      { label: "Changelog", href: "/changelog" },
      { label: "API docs", href: "/docs/api" },
      { label: "Open dashboard", href: "/dashboard" },
    ],
  },
  {
    title: "Solutions",
    links: [
      ...solutionList.map((solution) => ({
        label: solution.footerLabel,
        href: `/solutions/${solution.slug}`,
      })),
      { label: "All solutions", href: "/solutions" },
    ],
  },
  {
    title: "Compare",
    links: [
      { label: "vs Bitly", href: "/compare/bitly" },
      { label: "vs TinyURL", href: "/compare/tinyurl" },
      { label: "vs Rebrandly", href: "/compare/rebrandly" },
      { label: "vs Short.io", href: "/compare/short-io" },
      { label: "vs Dub", href: "/compare/dub" },
      { label: "vs Linktree", href: "/compare/linktree" },
      { label: "vs Beacons", href: "/compare/beacons" },
      { label: "vs Carrd", href: "/compare/carrd" },
      { label: "All comparisons", href: "/compare" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Blog", href: "/blog" },
      { label: "Docs", href: "/docs" },
      { label: "Support", href: "mailto:support@ishortn.ink" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Report abuse", href: "/abuse" },
    ],
  },
];

const socials: { label: string; href: string; icon: SiteIconName }[] = [
  { label: "X (Twitter)", href: "https://twitter.com/kelamoaba", icon: "brand-x" },
  { label: "GitHub", href: "https://github.com/AmoabaKelvin/ishortn.ink", icon: "brand-github" },
  { label: "Email support", href: "mailto:support@ishortn.ink", icon: "mail" },
];

const isExternal = (href: string) => href.startsWith("http") || href.startsWith("mailto:");

export const Footer = () => {
  return (
    <footer>
      <Section className="py-16 sm:py-20">
        <div className="grid gap-x-8 gap-y-14 xl:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)]">
          <div>
            <Link href="/" aria-label="Homepage">
              <Wordmark className="text-2xl" />
            </Link>
            <p className="mt-5 max-w-[36ch] text-pretty text-base text-neutral-700 sm:text-sm">
              Short links, QR codes, and link-in-bio pages with analytics you can actually read.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <ul className="flex items-center gap-1">
                {socials.map((social) => (
                  <li key={social.label}>
                    <a
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={social.label}
                      className="grid size-9 place-items-center rounded-lg text-neutral-700 hover:bg-neutral-950/5 hover:text-neutral-900"
                    >
                      <SiteIcon name={social.icon} className="size-5" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <p className="mt-8 text-base text-neutral-600 sm:text-sm">
              © {new Date().getFullYear()} iShortn. Built by{" "}
              <a
                href="https://twitter.com/kelamoaba"
                target="_blank"
                rel="noopener noreferrer"
                className="text-neutral-900 underline decoration-neutral-300 underline-offset-4 hover:decoration-neutral-900"
              >
                Amoaba Kelvin
              </a>
              .
            </p>
          </div>

          <nav
            aria-label="Footer"
            className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3 lg:grid-cols-5"
          >
            {columns.map((column) => (
              <div key={column.title}>
                <h3 className="font-title text-base font-semibold text-neutral-900">
                  {column.title}
                </h3>
                <ul className="mt-4 space-y-3">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      {isExternal(link.href) ? (
                        <a
                          href={link.href}
                          target={link.href.startsWith("http") ? "_blank" : undefined}
                          rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
                          className="text-base font-normal text-neutral-700 hover:text-neutral-900 sm:text-[0.9375rem]"
                        >
                          {link.label}
                        </a>
                      ) : (
                        <Link
                          href={link.href}
                          hrefLang={link.lang}
                          lang={link.lang}
                          className="text-base font-normal text-neutral-700 hover:text-neutral-900 sm:text-[0.9375rem]"
                        >
                          {link.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
      </Section>
    </footer>
  );
};
