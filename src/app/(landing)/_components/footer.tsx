import { IconBrandGithub, IconBrandX } from "@tabler/icons-react";
import { Link } from "next-view-transitions";

import { APP_TITLE } from "@/lib/constants/app";

const githubUrl = "https://github.com/AmoabaKelvin/ishortn.ink";
const twitterUrl = "https://twitter.com/kelamoaba";

const isExternalHref = (href: string) =>
  href.startsWith("http") || href.startsWith("mailto:");

const FooterLink = ({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) => {
  const className =
    "block py-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-300";

  if (isExternalHref(href)) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
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
    { name: "vs Bitly", href: "/compare/bitly" },
    { name: "vs TinyURL", href: "/compare/tinyurl" },
    { name: "vs Rebrandly", href: "/compare/rebrandly" },
    { name: "vs Short.io", href: "/compare/short-io" },
    { name: "vs Dub", href: "/compare/dub" },
  ],
  legal: [
    { name: "Privacy", href: "/privacy" },
    { name: "Terms", href: "/terms" },
  ],
};

export const Footer = () => {
  return (
    <footer className="border-t border-zinc-800 bg-zinc-950 px-6 pb-8 pt-16">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-6">
          {/* Brand */}
          <div className="col-span-2">
            <Link href="/" className="font-logo text-[17px] text-zinc-50">
              {APP_TITLE}
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-zinc-500">
              Simple, fast link shortening with analytics. Track your impact.
            </p>
            <div className="mt-6 flex gap-4">
              <a
                href={githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-500 transition-colors hover:text-zinc-50"
              >
                <IconBrandGithub size={18} />
              </a>
              <a
                href={twitterUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-500 transition-colors hover:text-zinc-50"
              >
                <IconBrandX size={18} />
              </a>
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className="mb-4 text-xs font-medium uppercase tracking-wider text-zinc-400">
              Product
            </h4>
            <ul>
              {footerLinks.product.map((link) => (
                <li key={link.name}>
                  <FooterLink href={link.href}>{link.name}</FooterLink>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="mb-4 text-xs font-medium uppercase tracking-wider text-zinc-400">
              Resources
            </h4>
            <ul>
              {footerLinks.resources.map((link) => (
                <li key={link.name}>
                  <FooterLink href={link.href}>{link.name}</FooterLink>
                </li>
              ))}
            </ul>
          </div>

          {/* Compare */}
          <div>
            <h4 className="mb-4 text-xs font-medium uppercase tracking-wider text-zinc-400">
              Compare
            </h4>
            <ul>
              {footerLinks.compare.map((link) => (
                <li key={link.name}>
                  <FooterLink href={link.href}>{link.name}</FooterLink>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="mb-4 text-xs font-medium uppercase tracking-wider text-zinc-400">
              Legal
            </h4>
            <ul>
              {footerLinks.legal.map((link) => (
                <li key={link.name}>
                  <FooterLink href={link.href}>{link.name}</FooterLink>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-zinc-800 pt-8 md:flex-row">
          <p className="text-xs text-zinc-600">
            &copy; {new Date().getFullYear()} iShortn. All rights reserved.
          </p>
          <p className="text-xs text-zinc-600">
            Built by{" "}
            <a
              href={twitterUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-500 transition-colors hover:text-zinc-300"
            >
              Amoaba Kelvin
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
};
