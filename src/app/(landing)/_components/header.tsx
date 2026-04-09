"use client";

import { SignedIn, SignedOut } from "@clerk/nextjs";
import { IconMenu2, IconX } from "@tabler/icons-react";
import { motion } from "framer-motion";
import { Link } from "next-view-transitions";
import { useEffect, useState } from "react";

import { APP_TITLE } from "@/lib/constants/app";

const routes = [
  { name: "Features", href: "/features" },
  { name: "Pricing", href: "/pricing" },
  { name: "FAQ", href: "/#faq" },
  { name: "Changelog", href: "/changelog" },
  { name: "Blog", href: "/blog" },
] as const;

const handleSmoothScroll = (
  event: React.MouseEvent<HTMLAnchorElement>,
  href: string,
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
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className={`mx-auto flex max-w-5xl items-center justify-between px-6 py-4 transition-all duration-300 ${
          scrolled
            ? "mt-3 rounded-full border border-neutral-200 bg-white/90 px-6 shadow-sm backdrop-blur-md"
            : "bg-transparent"
        }`}
      >
        {/* Logo */}
        <Link href="/" className="font-logo text-[20px] tracking-tight text-neutral-900">
          {APP_TITLE}
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-8 md:flex">
          {routes.map(({ name, href }) => (
            <Link
              key={name}
              href={href}
              onClick={(e) => handleSmoothScroll(e, href)}
              className="text-[13px] text-neutral-500 transition-colors hover:text-neutral-900"
            >
              {name}
            </Link>
          ))}
        </nav>

        {/* CTA Buttons */}
        <div className="hidden items-center gap-4 md:flex">
          <SignedOut>
            <Link
              href="/auth/sign-in"
              className="text-[13px] text-neutral-500 transition-colors hover:text-neutral-900"
            >
              Log in
            </Link>
            <Link
              href="/auth/sign-up"
              className="rounded-full bg-neutral-900 px-5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-neutral-800"
            >
              Get Started
            </Link>
          </SignedOut>
          <SignedIn>
            <Link
              href="/dashboard"
              className="rounded-full bg-neutral-900 px-5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-neutral-800"
            >
              Dashboard
            </Link>
          </SignedIn>
        </div>

        {/* Mobile Menu Button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="rounded-md p-1.5 text-neutral-600 transition-colors hover:text-neutral-900 md:hidden"
        >
          {mobileMenuOpen ? (
            <IconX size={20} stroke={1.5} />
          ) : (
            <IconMenu2 size={20} stroke={1.5} />
          )}
        </button>
      </motion.nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="mx-6 mt-1 rounded-2xl border border-neutral-200 bg-white p-5 shadow-lg md:hidden"
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
                className="rounded-lg px-3 py-2.5 text-sm text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-neutral-900"
              >
                {name}
              </Link>
            ))}
            <div className="my-2 h-px bg-neutral-100" />
            <SignedOut>
              <Link
                href="/auth/sign-in"
                className="rounded-lg px-3 py-2.5 text-sm text-neutral-600 transition-colors hover:bg-neutral-50"
              >
                Log in
              </Link>
              <Link
                href="/auth/sign-up"
                className="mt-1 rounded-lg bg-neutral-900 px-3 py-2.5 text-center text-sm font-medium text-white"
              >
                Get Started
              </Link>
            </SignedOut>
            <SignedIn>
              <Link
                href="/dashboard"
                className="mt-1 rounded-lg bg-neutral-900 px-3 py-2.5 text-center text-sm font-medium text-white"
              >
                Dashboard
              </Link>
            </SignedIn>
          </nav>
        </motion.div>
      )}
    </header>
  );
};
