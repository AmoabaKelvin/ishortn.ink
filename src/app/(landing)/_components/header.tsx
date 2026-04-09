"use client";

import { SignedIn, SignedOut } from "@clerk/nextjs";
import { IconMenu2, IconX } from "@tabler/icons-react";
import { motion } from "framer-motion";
import { Link } from "next-view-transitions";
import { useEffect, useState } from "react";

import { APP_TITLE, Paths } from "@/lib/constants/app";

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
    <motion.header
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/50"
          : "bg-transparent"
      }`}
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        {/* Logo */}
        <Link href="/" className="font-logo text-[17px] text-zinc-50">
          {APP_TITLE}
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden items-center gap-8 md:flex">
          {routes.map(({ name, href }) => (
            <Link
              key={name}
              href={href}
              onClick={(e) => handleSmoothScroll(e, href)}
              className="text-sm text-zinc-400 transition-colors hover:text-zinc-50"
            >
              {name}
            </Link>
          ))}
        </div>

        {/* CTA Buttons */}
        <div className="hidden items-center gap-4 md:flex">
          <SignedOut>
            <Link
              href={Paths.Login}
              className="text-sm text-zinc-400 transition-colors hover:text-zinc-50"
            >
              Log in
            </Link>
            <Link
              href={Paths.Signup}
              className="rounded-full bg-zinc-50 px-5 py-2 text-sm font-medium text-zinc-950 transition-colors hover:bg-white"
            >
              Get Started
            </Link>
          </SignedOut>
          <SignedIn>
            <Link
              href={Paths.Dashboard}
              className="rounded-full bg-zinc-50 px-5 py-2 text-sm font-medium text-zinc-950 transition-colors hover:bg-white"
            >
              Dashboard
            </Link>
          </SignedIn>
        </div>

        {/* Mobile Menu Button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="rounded-md p-1.5 text-zinc-400 transition-colors hover:text-zinc-50 md:hidden"
        >
          {mobileMenuOpen ? (
            <IconX size={20} stroke={1.5} />
          ) : (
            <IconMenu2 size={20} stroke={1.5} />
          )}
        </button>
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="mx-6 mt-1 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 md:hidden"
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
                className="rounded-lg px-3 py-2.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-50"
              >
                {name}
              </Link>
            ))}
            <div className="my-2 h-px bg-zinc-800" />
            <SignedOut>
              <Link
                href={Paths.Login}
                className="rounded-lg px-3 py-2.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-50"
              >
                Log in
              </Link>
              <Link
                href={Paths.Signup}
                className="mt-1 rounded-lg bg-zinc-50 px-3 py-2.5 text-center text-sm font-medium text-zinc-950"
              >
                Get Started
              </Link>
            </SignedOut>
            <SignedIn>
              <Link
                href={Paths.Dashboard}
                className="mt-1 rounded-lg bg-zinc-50 px-3 py-2.5 text-center text-sm font-medium text-zinc-950"
              >
                Dashboard
              </Link>
            </SignedIn>
          </nav>
        </motion.div>
      )}
    </motion.header>
  );
};
