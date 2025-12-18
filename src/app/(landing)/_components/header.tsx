"use client";

import { SignedIn, SignedOut } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Link } from "next-view-transitions";
import { useState } from "react";

import { APP_TITLE } from "@/lib/constants/app";

const routes = [
  { name: "Features", href: "/#features" },
  { name: "Pricing", href: "/#pricing" },
  { name: "Testimonials", href: "/#testimonials" },
  { name: "FAQ", href: "/#faq" },
  { name: "Changelog", href: "/changelog" },
] as const;

const handleSmoothScroll = (
  event: React.MouseEvent<HTMLAnchorElement>,
  href: string
) => {
  if (href.startsWith("/#")) {
    event.preventDefault();
    const targetId = href.split("#")[1];
    const targetElement = document.getElementById(targetId!);
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: "smooth" });
    }
  }
};

export const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div className="mx-auto max-w-6xl px-4">
        <motion.nav
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mt-4 flex items-center justify-between rounded-full border border-neutral-200/60 bg-white/80 px-6 py-3 shadow-lg shadow-neutral-900/5 backdrop-blur-md"
        >
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-semibold tracking-tight text-neutral-900"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900">
              <span className="text-sm font-bold text-white">i</span>
            </div>
            {APP_TITLE}
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-1 md:flex">
            {routes.map(({ name, href }) => (
              <Link
                key={name}
                href={href}
                onClick={(e) => handleSmoothScroll(e, href)}
                className="rounded-full px-4 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
              >
                {name}
              </Link>
            ))}
          </nav>

          {/* CTA Buttons */}
          <div className="hidden items-center gap-3 md:flex">
            <SignedOut>
              <Link
                href="/auth/sign-in"
                className="text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-900"
              >
                Log in
              </Link>
              <Link
                href="/auth/sign-up"
                className="rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-neutral-800 hover:shadow-lg hover:shadow-neutral-900/20"
              >
                Get Started
              </Link>
            </SignedOut>
            <SignedIn>
              <Link
                href="/dashboard"
                className="rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-neutral-800 hover:shadow-lg hover:shadow-neutral-900/20"
              >
                Dashboard
              </Link>
            </SignedIn>
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-full p-2 text-neutral-600 transition-colors hover:bg-neutral-100 md:hidden"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </motion.nav>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-2 rounded-2xl border border-neutral-200/60 bg-white/95 p-4 shadow-lg backdrop-blur-md md:hidden"
          >
            <nav className="flex flex-col gap-1">
              {routes.map(({ name, href }) => (
                <Link
                  key={name}
                  href={href}
                  onClick={(e) => {
                    handleSmoothScroll(e, href);
                    setMobileMenuOpen(false);
                  }}
                  className="rounded-xl px-4 py-3 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                >
                  {name}
                </Link>
              ))}
              <div className="my-2 h-px bg-neutral-200" />
              <SignedOut>
                <Link
                  href="/auth/sign-in"
                  className="rounded-xl px-4 py-3 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                >
                  Log in
                </Link>
                <Link
                  href="/auth/sign-up"
                  className="mt-1 rounded-xl bg-neutral-900 px-4 py-3 text-center text-sm font-medium text-white transition-all hover:bg-neutral-800"
                >
                  Get Started
                </Link>
              </SignedOut>
              <SignedIn>
                <Link
                  href="/dashboard"
                  className="mt-1 rounded-xl bg-neutral-900 px-4 py-3 text-center text-sm font-medium text-white transition-all hover:bg-neutral-800"
                >
                  Dashboard
                </Link>
              </SignedIn>
            </nav>
          </motion.div>
        )}
      </div>
    </header>
  );
};
