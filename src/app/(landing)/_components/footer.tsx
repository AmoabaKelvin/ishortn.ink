"use client";

import { IconBrandGithub, IconBrandX } from "@tabler/icons-react";
import { Link } from "next-view-transitions";

import { APP_TITLE } from "@/lib/constants/app";


const githubUrl = "https://github.com/AmoabaKelvin/ishortn.ink";
const twitterUrl = "https://twitter.com/kelamoaba";

const isExternalHref = (href: string) => href.startsWith("http") || href.startsWith("mailto:");

const FooterLink = ({ href, children }: { href: string; children: React.ReactNode }) => {
  const className = "text-sm text-neutral-500 transition-colors hover:text-neutral-900";

  if (isExternalHref(href)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
};

const footerLinks = {
  product: [
    { name: "Features", href: "/features" },
    { name: "Pricing", href: "/pricing" },
    { name: "API", href: "https://docs.ishortn.ink/api" },
    { name: "Changelog", href: "/changelog" },
  ],
  resources: [
    { name: "Blog", href: "/blog" },
    { name: "Documentation", href: "https://ishortn.ink/docs" },
    { name: "Support", href: "mailto:support@ishortn.ink" },
    { name: "Status", href: "https://status.ishortn.ink" },
  ],
  compare: [
    { name: "iShortn vs Bitly", href: "/compare/bitly" },
    { name: "iShortn vs TinyURL", href: "/compare/tinyurl" },
    { name: "iShortn vs Rebrandly", href: "/compare/rebrandly" },
    { name: "iShortn vs Short.io", href: "/compare/short-io" },
    { name: "iShortn vs Dub", href: "/compare/dub" },
  ],
  legal: [
    { name: "Privacy", href: "/privacy" },
    { name: "Terms", href: "/terms" },
    { name: "Cookies", href: "/cookies" },
  ],
};

export const Footer = () => {
  return (
    <footer className="border-t border-neutral-100 px-6">
      <div className="mx-auto max-w-5xl py-16">
        <div className="grid gap-10 md:grid-cols-12">
          {/* Brand */}
          <div className="md:col-span-4">
            <Link href="/" className="font-logo text-[20px] tracking-tight text-neutral-900">
              {APP_TITLE}
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-neutral-400">
              Simple, fast link shortening with analytics. Track your impact.
            </p>
            <div className="mt-5 flex gap-3">
              <a
                href={twitterUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
              >
                <IconBrandX size={18} stroke={1.5} />
              </a>
              <a
                href={githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
              >
                <IconBrandGithub size={18} stroke={1.5} />
              </a>
            </div>
          </div>

          {/* Links */}
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 md:col-span-8">
            <div>
              <h4 className="mb-3 text-[11px] font-medium uppercase tracking-wider text-neutral-400">
                Product
              </h4>
              <ul className="space-y-2.5">
                {footerLinks.product.map((link) => (
                  <li key={link.name}>
                    <FooterLink href={link.href}>{link.name}</FooterLink>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="mb-3 text-[11px] font-medium uppercase tracking-wider text-neutral-400">
                Resources
              </h4>
              <ul className="space-y-2.5">
                {footerLinks.resources.map((link) => (
                  <li key={link.name}>
                    <FooterLink href={link.href}>{link.name}</FooterLink>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="mb-3 text-[11px] font-medium uppercase tracking-wider text-neutral-400">
                Compare
              </h4>
              <ul className="space-y-2.5">
                {footerLinks.compare.map((link) => (
                  <li key={link.name}>
                    <FooterLink href={link.href}>{link.name}</FooterLink>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="mb-3 text-[11px] font-medium uppercase tracking-wider text-neutral-400">
                Legal
              </h4>
              <ul className="space-y-2.5">
                {footerLinks.legal.map((link) => (
                  <li key={link.name}>
                    <FooterLink href={link.href}>{link.name}</FooterLink>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-14 flex flex-col items-center justify-between gap-3 border-t border-neutral-100 pt-8 text-xs text-neutral-400 md:flex-row">
          <p>
            &copy; {new Date().getFullYear()} {APP_TITLE}. All rights reserved.
          </p>
          <p>
            Built by{" "}
            <a
              href={twitterUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-600 underline underline-offset-4 transition-colors hover:text-neutral-900"
            >
              Amoaba Kelvin
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
};
