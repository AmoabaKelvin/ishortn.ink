"use client";

import { IconCheck, IconTagFilled } from "@tabler/icons-react";
import { useState, useSyncExternalStore } from "react";

import { readAttribution } from "@/lib/billing/attribution";
import { PLAN_FEATURES } from "@/lib/billing/plan-features";
import { planPriceDisplay, planSignupHref, resolveBillingInterval } from "@/lib/billing/pricing";
import { promoBannerText } from "@/lib/billing/promo";
import { cn } from "@/lib/utils";

import {
  ButtonLink,
  cardClass,
  Eyebrow,
  h3Class,
  Section,
  SectionHeading,
} from "./site-primitives";

import type { Attribution } from "@/lib/billing/attribution";
import type { BillingInterval } from "@/lib/billing/plans";
import type { Promo } from "@/lib/billing/promo";

const buildPlans = (interval: BillingInterval, promo: Promo | null, attribution: Attribution) => [
  {
    name: "Free",
    price: planPriceDisplay("free", interval),
    tagline: "For side projects and trying things out.",
    cta: "Start for free",
    href: `/auth/sign-up?next=${encodeURIComponent("/dashboard")}`,
    featured: false,
    features: PLAN_FEATURES.free.features,
  },
  {
    name: "Pro",
    price: planPriceDisplay("pro", interval, promo),
    tagline: "For creators, makers, and growing teams.",
    cta: "Get Pro",
    href: planSignupHref("pro", interval, attribution),
    featured: true,
    features: PLAN_FEATURES.pro.features,
  },
  {
    name: "Ultra",
    price: planPriceDisplay("ultra", interval, promo),
    tagline: "For agencies and teams that want no limits.",
    cta: "Go Ultra",
    href: planSignupHref("ultra", interval, attribution),
    featured: false,
    features: PLAN_FEATURES.ultra.features,
  },
];

const subscribeToNothing = () => () => {};
const readSearch = () => window.location.search;

// The /pricing page renders its own hero heading, so it hides this one. `promo` is resolved on the
// server by the page so the offer is in the first paint.
export const Pricing = ({
  showHeading = true,
  promo = null,
  className,
}: {
  showHeading?: boolean;
  promo?: Promo | null;
  className?: string;
}) => {
  // The marketing pages are static, so `?interval=monthly` is read from the URL on the client
  // (the server snapshot is the annual default) rather than through useSearchParams, which would
  // need a Suspense boundary around the whole section.
  // The same goes for `?source=`/`utm_*`, carried into the sign-up link so the checkout after
  // sign-up keeps the visit's attribution.
  const search = useSyncExternalStore(subscribeToNothing, readSearch, () => "");
  const params = new URLSearchParams(search);
  const intervalParam = params.get("interval");
  const [selected, setBillingInterval] = useState<BillingInterval | null>(null);
  const [priceFade, setPriceFade] = useState(false);
  const interval = selected ?? resolveBillingInterval(intervalParam);
  const plans = buildPlans(interval, promo, readAttribution(params));

  return (
    <Section id="pricing" className={className}>
      {showHeading && (
        <SectionHeading
          eyebrow={<Eyebrow icon={<IconTagFilled aria-hidden="true" />}>Pricing</Eyebrow>}
          title="Simple pricing, no surprises"
          subtitle="Start free. Upgrade when you're ready. Cancel anytime."
        />
      )}

      <div
        className={cn("flex flex-wrap items-center justify-center gap-3", showHeading && "mt-8")}
      >
        <div className="inline-flex rounded-[10px] bg-neutral-950/[0.06] p-0.5">
          {(["monthly", "annual"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={interval === value}
              onClick={() => {
                setBillingInterval(value);
                setPriceFade(true);
              }}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-base font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 sm:text-sm",
                interval === value
                  ? "bg-white text-neutral-900 shadow-site-btn"
                  : "text-neutral-600 hover:text-neutral-900",
              )}
            >
              {value === "annual" ? "Annual" : "Monthly"}
            </button>
          ))}
        </div>
        <span className="text-base font-medium text-neutral-600 sm:text-sm">2 months free</span>
      </div>

      {promo && (
        <p
          className={cn(
            cardClass,
            "mt-8 flex items-start gap-2.5 px-5 py-4 text-pretty text-base text-neutral-900 sm:items-center sm:justify-center sm:text-sm",
          )}
        >
          <IconTagFilled aria-hidden="true" className="mt-1 size-4 shrink-0 sm:mt-0" />
          {promoBannerText(promo)}
        </p>
      )}

      <div className={cn("grid gap-4 lg:grid-cols-3", promo ? "mt-8" : "mt-12")}>
        {plans.map((p) => (
          <div key={p.name} className={cn(cardClass, "flex flex-col p-6 sm:p-8")}>
            <div>
              <div className="flex items-center gap-2">
                <h3 className={h3Class}>{p.name}</h3>
                {p.featured && (
                  <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-xs font-medium text-white">
                    Popular
                  </span>
                )}
              </div>
              <p className="mt-2 text-pretty text-base text-neutral-600 sm:text-sm">{p.tagline}</p>
              {/* Keyed on the figure so a toggle fades the new price in; always two lines so the
                  cards keep the same height on both intervals. */}
              <div
                key={`${p.price.perMonth}-${p.price.note}`}
                className={cn(
                  "mt-6",
                  priceFade &&
                    "motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150 motion-safe:ease-out",
                )}
              >
                <p className="flex items-baseline gap-1.5 whitespace-nowrap">
                  {p.price.compareAt && (
                    <del className="text-xl tabular-nums text-neutral-500">
                      <span className="sr-only">Regular price </span>${p.price.compareAt}
                    </del>
                  )}
                  <span className="font-title text-5xl font-semibold tabular-nums tracking-tight text-neutral-900">
                    ${p.price.perMonth}
                  </span>
                  <span className="text-base text-neutral-600">/mo</span>
                </p>
                <p className="mt-1 text-base tabular-nums text-neutral-600 sm:text-sm">
                  {p.price.note}
                </p>
              </div>
              <ButtonLink
                href={p.href}
                variant={p.featured ? "primary" : "secondary"}
                className="mt-6 w-full"
              >
                {p.cta}
              </ButtonLink>
              <hr className="my-6 border-neutral-950/[0.07]" />
              <ul className="flex flex-col gap-3">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2.5 text-base text-neutral-700 sm:text-sm">
                    <IconCheck
                      aria-hidden="true"
                      className="mt-1 size-4 shrink-0 text-neutral-900"
                    />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
};
