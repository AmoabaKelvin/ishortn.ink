import { IconBrandGithub, IconBrandX, IconMail } from "@tabler/icons-react";
import { Link } from "next-view-transitions";

import { Section, Wordmark } from "./site-primitives";

const columns = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/features" },
      { label: "Pricing", href: "/pricing" },
      { label: "Changelog", href: "/changelog" },
      { label: "API docs", href: "https://docs.ishortn.ink/api" },
      { label: "Open dashboard", href: "/dashboard" },
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
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Blog", href: "/blog" },
      { label: "Documentation", href: "https://ishortn.ink/docs" },
      { label: "Support", href: "mailto:support@ishortn.ink" },
      { label: "Status", href: "https://status.ishortn.ink" },
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

const socials = [
  { label: "X (Twitter)", href: "https://twitter.com/kelamoaba", icon: IconBrandX },
  { label: "GitHub", href: "https://github.com/AmoabaKelvin/ishortn.ink", icon: IconBrandGithub },
  { label: "Email support", href: "mailto:support@ishortn.ink", icon: IconMail },
];

const isExternal = (href: string) => href.startsWith("http") || href.startsWith("mailto:");

export const Footer = () => {
  return (
    <footer>
      <Section className="py-16 sm:py-20">
        <div className="grid gap-x-8 gap-y-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div>
            <Link href="/" aria-label="Homepage">
              <Wordmark className="text-2xl" />
            </Link>
            <p className="mt-5 max-w-[36ch] text-pretty text-base text-neutral-700 sm:text-sm">
              Short links, QR codes, and link-in-bio pages with analytics you can actually read.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href="https://status.ishortn.ink"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 font-mono text-xs font-medium text-neutral-800 shadow-site-btn hover:bg-neutral-50"
              >
                All systems operational
                <span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-500" />
              </a>
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
                      <social.icon aria-hidden="true" className="size-5" />
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

          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-4">
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
