"use client";

import { IconCheck, IconTagFilled } from "@tabler/icons-react";
import { useState } from "react";

import { PLAN_FEATURES } from "@/lib/billing/plan-features";
import { PLAN_PRICES_ANNUAL_USD, PLAN_PRICES_USD } from "@/lib/constants/plan-pricing";
import { cn } from "@/lib/utils";

import {
  ButtonLink,
  cardClass,
  Eyebrow,
  h3Class,
  Section,
  SectionHeading,
} from "./site-primitives";

const signupHref = (next: string) => `/auth/sign-up?next=${encodeURIComponent(next)}`;

const buildPlans = (annual: boolean) => [
  {
    name: "Free",
    price: PLAN_PRICES_USD.free,
    cadence: "forever",
    tagline: "For side projects and trying things out.",
    cta: "Start for free",
    href: signupHref("/dashboard"),
    featured: false,
    features: PLAN_FEATURES.free.features,
  },
  {
    name: "Pro",
    price: annual ? PLAN_PRICES_ANNUAL_USD.pro : PLAN_PRICES_USD.pro,
    cadence: annual ? "/year" : "/month",
    tagline: "For creators, makers, and growing teams.",
    cta: "Get Pro",
    href: signupHref(`/dashboard/pricing?plan=pro${annual ? "&interval=annual" : ""}`),
    featured: true,
    features: PLAN_FEATURES.pro.features,
  },
  {
    name: "Ultra",
    price: annual ? PLAN_PRICES_ANNUAL_USD.ultra : PLAN_PRICES_USD.ultra,
    cadence: annual ? "/year" : "/month",
    tagline: "For agencies and teams that want no limits.",
    cta: "Go Ultra",
    href: signupHref(`/dashboard/pricing?plan=ultra${annual ? "&interval=annual" : ""}`),
    featured: false,
    features: PLAN_FEATURES.ultra.features,
  },
];

export const Pricing = () => {
  const [annual, setAnnual] = useState(false);
  const plans = buildPlans(annual);

  return (
    <Section id="pricing">
      <SectionHeading
        eyebrow={<Eyebrow icon={<IconTagFilled aria-hidden="true" />}>Pricing</Eyebrow>}
        title="Simple pricing, no surprises"
        subtitle="Start free. Upgrade when you're ready. Cancel anytime."
      />

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <div className="inline-flex rounded-[10px] bg-neutral-950/[0.06] p-0.5">
          {([false, true] as const).map((value) => (
            <button
              key={String(value)}
              type="button"
              aria-pressed={annual === value}
              onClick={() => setAnnual(value)}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-base font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 sm:text-sm",
                annual === value
                  ? "bg-white text-neutral-900 shadow-site-btn"
                  : "text-neutral-600 hover:text-neutral-900",
              )}
            >
              {value ? "Annual" : "Monthly"}
            </button>
          ))}
        </div>
        <span className="text-base font-medium text-neutral-600 sm:text-sm">Save 2 months</span>
      </div>

      <div className="mt-12 grid gap-4 lg:grid-cols-3">
        {plans.map((p) => (
          <div key={p.name} className={cn(cardClass, "flex flex-col justify-between p-6 sm:p-8")}>
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
              <p className="mt-6 flex items-baseline gap-1.5">
                <span className="font-title text-5xl font-semibold tabular-nums tracking-tight text-neutral-900">
                  ${p.price}
                </span>
                <span className="text-base text-neutral-600">{p.cadence}</span>
              </p>
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
            <ButtonLink
              href={p.href}
              variant={p.featured ? "primary" : "secondary"}
              className="mt-8 w-full"
            >
              {p.cta}
            </ButtonLink>
          </div>
        ))}
      </div>
    </Section>
  );
};
