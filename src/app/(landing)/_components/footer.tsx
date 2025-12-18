"use client";

import { motion } from "framer-motion";
import { Github, Heart, Twitter } from "lucide-react";
import { Link } from "next-view-transitions";

import { APP_TITLE } from "@/lib/constants/app";

const githubUrl = "https://github.com/AmoabaKelvin/ishortn.ink";
const twitterUrl = "https://twitter.com/kelamoaba";

const footerLinks = {
  product: [
    { name: "Features", href: "/#features" },
    { name: "Pricing", href: "/#pricing" },
    { name: "API", href: "/docs/api" },
    { name: "Changelog", href: "/changelog" },
  ],
  resources: [
    { name: "Documentation", href: "https://ishortn.ink/docs" },
    { name: "Blog", href: "/blog" },
    { name: "Support", href: "mailto:support@ishortn.ink" },
    { name: "Status", href: "/status" },
  ],
  legal: [
    { name: "Privacy", href: "/privacy" },
    { name: "Terms", href: "/terms" },
    { name: "Cookies", href: "/cookies" },
  ],
};

export const Footer = () => {
  return (
    <footer className="relative overflow-hidden border-t border-neutral-200/60 bg-white">
      {/* Background */}
      <div className="noise-overlay" />

      <div className="landing-container relative z-10 px-4 py-16">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-5">
          {/* Brand Column */}
          <div className="lg:col-span-2">
            <Link
              href="/"
              className="flex items-center gap-2 text-xl font-semibold tracking-tight text-neutral-900"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-900">
                <span className="text-sm font-bold text-white">i</span>
              </div>
              {APP_TITLE}
            </Link>
            <p className="mt-4 max-w-sm text-neutral-600">
              Simple, fast, and powerful link shortening with analytics. Transform
              your URLs and track your impact.
            </p>
            <div className="mt-6 flex gap-4">
              <a
                href={twitterUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 transition-colors hover:bg-neutral-200 hover:text-neutral-900"
              >
                <Twitter className="h-4 w-4" />
              </a>
              <a
                href={githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 transition-colors hover:bg-neutral-200 hover:text-neutral-900"
              >
                <Github className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Links Columns */}
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-900">
              Product
            </h4>
            <ul className="space-y-3">
              {footerLinks.product.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm text-neutral-600 transition-colors hover:text-neutral-900"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-900">
              Resources
            </h4>
            <ul className="space-y-3">
              {footerLinks.resources.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm text-neutral-600 transition-colors hover:text-neutral-900"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-900">
              Legal
            </h4>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm text-neutral-600 transition-colors hover:text-neutral-900"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-neutral-200/60 pt-8 md:flex-row"
        >
          <p className="text-sm text-neutral-500">
            &copy; {new Date().getFullYear()} {APP_TITLE}. All rights reserved.
          </p>
          <p className="flex items-center gap-1 text-sm text-neutral-500">
            Made with <Heart className="h-4 w-4 fill-red-500 text-red-500" /> by{" "}
            <a
              href={twitterUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-neutral-900 underline underline-offset-4 transition-colors hover:text-neutral-600"
            >
              Amoaba Kelvin
            </a>
          </p>
        </motion.div>
      </div>
    </footer>
  );
};
