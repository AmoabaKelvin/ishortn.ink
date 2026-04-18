"use client";

import { SignedIn, SignedOut } from "@clerk/nextjs";
import { Link } from "next-view-transitions";
import { useEffect, useState } from "react";

import { Paths } from "@/lib/constants/app";

import { Icon, Wordmark } from "./warm-primitives";

const routes = [
  { name: "Features", href: "/features" },
  { name: "Pricing", href: "/pricing" },
  { name: "Stories", href: "/#stories" },
  { name: "Changelog", href: "/changelog" },
] as const;

export const Header = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: scrolled ? "rgba(247,241,232,0.85)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: `1px solid ${scrolled ? "var(--warm-line-soft)" : "transparent"}`,
        transition: "all .25s",
      }}
    >
      <div
        className="warm-container"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 76,
        }}
      >
        <Link href="/" aria-label="iShortn home">
          <Wordmark />
        </Link>

        <div className="hidden md:flex" style={{ gap: 36 }}>
          {routes.map((x) => (
            <Link
              key={x.name}
              href={x.href}
              style={{ fontSize: 14, color: "var(--warm-ink-soft)" }}
            >
              {x.name}
            </Link>
          ))}
        </div>

        <div className="hidden md:flex" style={{ gap: 10 }}>
          <SignedOut>
            <Link
              href={Paths.Login}
              className="warm-btn warm-btn-ghost"
              style={{ padding: "10px 18px" }}
            >
              Sign in
            </Link>
            <Link
              href={Paths.Signup}
              className="warm-btn warm-btn-primary"
              style={{ padding: "10px 18px" }}
            >
              Get started <Icon.Arrow />
            </Link>
          </SignedOut>
          <SignedIn>
            <Link
              href={Paths.Dashboard}
              className="warm-btn warm-btn-primary"
              style={{ padding: "10px 18px" }}
            >
              Dashboard <Icon.Arrow />
            </Link>
          </SignedIn>
        </div>

        <button
          type="button"
          aria-label="Menu"
          onClick={() => setMobileOpen((o) => !o)}
          className="md:hidden"
          style={{
            padding: 8,
            background: "transparent",
            border: 0,
            color: "var(--warm-ink)",
            cursor: "pointer",
          }}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            {mobileOpen ? (
              <path
                d="M6 6l12 12M18 6L6 18"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : (
              <path
                d="M4 7h16M4 12h16M4 17h16"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </svg>
        </button>
      </div>

      {mobileOpen && (
        <div
          className="md:hidden"
          style={{
            margin: "0 16px 8px",
            padding: 18,
            background: "var(--warm-paper)",
            border: "1px solid var(--warm-line)",
            borderRadius: 20,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {routes.map((x) => (
              <Link
                key={x.name}
                href={x.href}
                onClick={() => setMobileOpen(false)}
                style={{
                  padding: "10px 12px",
                  fontSize: 14,
                  color: "var(--warm-ink-soft)",
                  borderRadius: 10,
                }}
              >
                {x.name}
              </Link>
            ))}
            <div
              style={{
                height: 1,
                background: "var(--warm-line-soft)",
                margin: "8px 0",
              }}
            />
            <SignedOut>
              <Link
                href={Paths.Login}
                className="warm-btn warm-btn-ghost"
                style={{
                  justifyContent: "center",
                  padding: "12px 16px",
                }}
              >
                Sign in
              </Link>
              <Link
                href={Paths.Signup}
                className="warm-btn warm-btn-primary"
                style={{
                  justifyContent: "center",
                  padding: "12px 16px",
                  marginTop: 6,
                }}
              >
                Get started <Icon.Arrow />
              </Link>
            </SignedOut>
            <SignedIn>
              <Link
                href={Paths.Dashboard}
                className="warm-btn warm-btn-primary"
                style={{
                  justifyContent: "center",
                  padding: "12px 16px",
                }}
              >
                Dashboard <Icon.Arrow />
              </Link>
            </SignedIn>
          </div>
        </div>
      )}
    </nav>
  );
};
