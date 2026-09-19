"use client";

import {
  IconChevronRight,
  IconCopy,
  IconLink,
  IconLock,
  IconQrcode,
  IconWorld,
} from "@tabler/icons-react";
import { Link } from "next-view-transitions";
import { useState } from "react";

import { Paths } from "@/lib/constants/app";
import { cn } from "@/lib/utils";

import {
  ButtonLink,
  buttonClass,
  h1Class,
  leadClass,
  panelClass,
  Section,
} from "./site-primitives";

// Illustrative numbers for the mock only
const bars = [38, 52, 44, 61, 47, 72, 58, 66, 49, 83, 70, 92, 64, 78];
const mutedBars = new Set([2, 8, 12]);
const countries = [
  { name: "United States", share: 42 },
  { name: "United Kingdom", share: 18 },
  { name: "Germany", share: 11 },
  { name: "Ghana", share: 9 },
  { name: "Japan", share: 6 },
];
const linkRows = [
  { icon: IconQrcode, label: "QR code ready" },
  { icon: IconWorld, label: "Custom domain" },
  { icon: IconLock, label: "Password protected" },
];
const recentClicks = [
  { place: "Accra, Ghana", meta: "Chrome · 2m ago" },
  { place: "London, United Kingdom", meta: "Safari · 5m ago" },
  { place: "Austin, United States", meta: "Firefox · 9m ago" },
  { place: "Berlin, Germany", meta: "Chrome · 14m ago" },
];

const LinkCardMock = () => (
  <div
    aria-hidden="true"
    className="absolute left-6 top-0 grid w-[640px] grid-cols-[1fr_1.15fr] divide-x divide-neutral-950/[0.07] overflow-hidden rounded-xl bg-white shadow-site-card sm:left-14 lg:-bottom-10 lg:left-4 lg:top-20 lg:w-[700px]"
  >
    <div className="min-w-0 p-6">
      <div className="flex items-center gap-2">
        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-neutral-900 text-white">
          <IconLink className="size-3" />
        </span>
        <span className="truncate font-mono text-sm font-medium text-neutral-900">
          ishortn.ink/launch
        </span>
        <IconCopy className="size-4 shrink-0 text-neutral-400" />
      </div>
      <p className="mt-2 truncate text-xs text-neutral-500">
        https://acme.com/blog/2026/product-launch-announcement?ref=newsletter
      </p>

      <div className="mt-5 grid grid-cols-4 rounded-lg bg-neutral-100 p-0.5 text-center text-xs font-medium text-neutral-500">
        {["24h", "7d", "30d", "All"].map((range) => (
          <span
            key={range}
            className={cn(
              "rounded-md py-1",
              range === "7d" && "bg-white text-neutral-900 shadow-site-btn",
            )}
          >
            {range}
          </span>
        ))}
      </div>

      <ul className="mt-5 space-y-3 text-[0.8125rem] text-neutral-700">
        {linkRows.map(({ icon: RowIcon, label }) => (
          <li key={label} className="flex items-center gap-2">
            <RowIcon className="size-4 shrink-0 text-neutral-500" />
            {label}
          </li>
        ))}
      </ul>

      <p className="mt-6 border-t border-neutral-950/[0.07] pt-5 text-xs font-medium text-neutral-500">
        Recent clicks
      </p>
      <ul className="mt-3 space-y-3">
        {recentClicks.map((click) => (
          <li key={click.place} className="min-w-0">
            <p className="truncate text-[0.8125rem] text-neutral-900">{click.place}</p>
            <p className="text-xs text-neutral-500">{click.meta}</p>
          </li>
        ))}
      </ul>
    </div>

    <div className="min-w-0 p-6">
      <p className="text-xs font-medium text-neutral-500">Clicks</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-title text-3xl font-semibold tracking-tight text-neutral-900 tabular-nums">
          12,847
        </span>
        <span className="text-xs font-medium text-emerald-600">+12.4%</span>
      </div>

      <div className="mt-5 flex h-32 items-end gap-1.5">
        {bars.map((height, i) => (
          <span
            // oxlint-disable-next-line react/no-array-index-key -- static mock data
            key={i}
            className={cn(
              "flex-1 rounded-sm",
              mutedBars.has(i) ? "bg-neutral-200" : "bg-neutral-900",
            )}
            style={{ height: `${height}%` }}
          />
        ))}
      </div>

      <p className="mt-6 text-xs font-medium text-neutral-500">Top countries</p>
      <ul className="mt-3 space-y-3">
        {countries.map((country) => (
          <li key={country.name}>
            <div className="flex justify-between text-[0.8125rem] text-neutral-700">
              <span>{country.name}</span>
              <span className="tabular-nums text-neutral-500">{country.share}%</span>
            </div>
            <div className="mt-1.5 h-1 rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full bg-neutral-900"
                style={{ width: `${country.share}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  </div>
);

export const Hero = () => {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const shorten = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    setLoading(true);
    window.location.assign(`${Paths.Signup}?url=${encodeURIComponent(trimmed)}`);
  };

  return (
    <Section className="px-3 py-3 sm:px-3 sm:py-3 xl:px-3">
      <div className={cn(panelClass, "relative grid overflow-hidden lg:grid-cols-2")}>
        <div className="min-w-0 px-6 py-12 sm:px-14 sm:py-20 lg:pr-8">
          <Link
            href="/changelog"
            className="inline-flex items-center gap-1 rounded-full bg-white py-1 pl-3 pr-1.5 text-[0.8125rem] font-medium text-neutral-800 shadow-site-btn hover:bg-neutral-50"
          >
            See what&apos;s new
            <IconChevronRight aria-hidden="true" className="size-4 shrink-0 opacity-70" />
          </Link>

          <h1 className={cn(h1Class, "mt-6 max-w-[14ch]")}>The better way to share your links</h1>
          <p className={cn(leadClass, "mt-5 max-w-[48ch]")}>
            Short links, QR codes, and link-in-bio pages with analytics built in. Made for creators,
            marketers, and teams who want to know what works.
          </p>

          <div className="mt-8 flex max-w-md flex-col gap-2">
            <form onSubmit={shorten} className="flex flex-col gap-2">
              <label htmlFor="hero-url" className="sr-only">
                Link to shorten
              </label>
              <input
                id="hero-url"
                name="url"
                required
                inputMode="url"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="Paste a long link here..."
                className="w-full min-w-0 rounded-[10px] bg-white px-3.5 py-2.5 text-base text-neutral-900 shadow-site-btn placeholder:text-neutral-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
              />
              <button
                type="submit"
                className={cn(
                  buttonClass({ variant: "primary", size: "lg", arrow: true }),
                  "w-full",
                )}
              >
                {loading ? "Redirecting…" : "Shorten link"}
                <IconChevronRight aria-hidden="true" className="size-4 shrink-0 opacity-70" />
              </button>
            </form>
            <ButtonLink href={Paths.Signup} variant="soft" size="lg" className="w-full">
              Sign up with email
            </ButtonLink>
          </div>
          <p className="mt-3 text-sm text-neutral-500">Free to start. No credit card required.</p>
        </div>

        <div className="relative h-72 lg:h-auto">
          <LinkCardMock />
        </div>
      </div>
    </Section>
  );
};
