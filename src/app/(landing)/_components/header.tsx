"use client";

import { SignedIn, SignedOut } from "@clerk/nextjs";
import { IconMenu2, IconX } from "@tabler/icons-react";
import { Link } from "next-view-transitions";
import { useEffect, useState } from "react";

import { Paths } from "@/lib/constants/app";
import { cn } from "@/lib/utils";

import { ButtonLink, Wordmark } from "./site-primitives";

const routes = [
  { name: "Features", href: "/features" },
  { name: "Pricing", href: "/pricing" },
  { name: "Blog", href: "/blog" },
  { name: "Changelog", href: "/changelog" },
] as const;

export const Header = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const raised = scrolled || mobileOpen;

  return (
    <header className="sticky top-0 z-50 px-3 pt-3">
      <div
        className={cn(
          "mx-auto max-w-[1240px] rounded-2xl",
          raised && "bg-white/90 shadow-site-card backdrop-blur-md",
        )}
      >
        <div className="flex items-center py-2.5 pl-4 pr-2.5 xl:pl-6">
          <div className="flex flex-1 items-center">
            <Link href="/" aria-label="Homepage">
              <Wordmark />
            </Link>
          </div>

          <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
            {routes.map((route) => (
              <Link
                key={route.name}
                href={route.href}
                className="rounded-lg px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-950/5 hover:text-neutral-900"
              >
                {route.name}
              </Link>
            ))}
          </nav>

          <div className="flex flex-1 items-center justify-end gap-1">
            <div className="hidden items-center gap-1 lg:flex">
              <SignedOut>
                <Link
                  href={Paths.Login}
                  className="rounded-lg px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-950/5"
                >
                  Sign in
                </Link>
                <ButtonLink href={Paths.Signup}>Get started</ButtonLink>
              </SignedOut>
              <SignedIn>
                <ButtonLink href={Paths.Dashboard}>Dashboard</ButtonLink>
              </SignedIn>
            </div>

            <button
              type="button"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              aria-controls="site-mobile-menu"
              onClick={() => setMobileOpen((open) => !open)}
              className="grid size-11 place-items-center rounded-lg text-neutral-900 hover:bg-neutral-950/5 lg:hidden"
            >
              {mobileOpen ? <IconX className="size-6" /> : <IconMenu2 className="size-6" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div id="site-mobile-menu" className="border-t border-neutral-950/[0.07] p-3 lg:hidden">
            <nav aria-label="Mobile" className="flex flex-col">
              {routes.map((route) => (
                <Link
                  key={route.name}
                  href={route.href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-base text-neutral-700 hover:bg-neutral-950/5"
                >
                  {route.name}
                </Link>
              ))}
            </nav>
            <div className="mt-3 grid gap-2 border-t border-neutral-950/[0.07] pt-3">
              <SignedOut>
                <ButtonLink href={Paths.Login} variant="secondary" size="lg" arrow={false}>
                  Sign in
                </ButtonLink>
                <ButtonLink href={Paths.Signup} size="lg">
                  Get started
                </ButtonLink>
              </SignedOut>
              <SignedIn>
                <ButtonLink href={Paths.Dashboard} size="lg">
                  Dashboard
                </ButtonLink>
              </SignedIn>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
