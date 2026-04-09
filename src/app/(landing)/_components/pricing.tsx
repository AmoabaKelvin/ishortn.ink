"use client";

import { IconArrowRight, IconCheck } from "@tabler/icons-react";
import { motion, useInView } from "framer-motion";
import { Link } from "next-view-transitions";
import { useRef } from "react";

import { Paths } from "@/lib/constants/app";

const plans = [
  {
    id: "free",
    name: "Free",
    description: "For personal projects",
    price: 0,
    period: "forever",
    features: [
      "30 links per month",
      "1,000 tracked events",
      "7 days analytics",
      "Basic customization",
    ],
    cta: "Get Started",
    popular: false,
  },
  {
    id: "pro",
    name: "Pro",
    description: "For creators & teams",
    price: 5,
    period: "per month",
    features: [
      "1,000 links per month",
      "10,000 tracked events",
      "Unlimited analytics",
      "3 custom domains",
      "API access",
      "Priority support",
    ],
    cta: "Start Free Trial",
    popular: true,
  },
  {
    id: "ultra",
    name: "Ultra",
    description: "For scale",
    price: 15,
    period: "per month",
    features: [
      "Unlimited everything",
      "Unlimited custom domains",
      "Advanced analytics",
      "Team collaboration",
      "Dedicated support",
      "Full API access",
    ],
    cta: "Contact Sales",
    popular: false,
  },
];

const PricingCard = ({
  plan,
  index,
}: {
  plan: (typeof plans)[number];
  index: number;
}) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const isPopular = plan.popular;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className={`relative flex flex-col rounded-2xl border p-7 transition-all ${
        isPopular
          ? "border-neutral-900 bg-neutral-900 text-white"
          : "border-neutral-200 dark:border-border bg-white dark:bg-card"
      }`}
    >
      {isPopular && (
        <span className="absolute -top-3 left-7 rounded-full bg-white px-3 py-1 text-[11px] font-medium text-neutral-900">
          Most popular
        </span>
      )}

      <div>
        <h3
          className={`text-sm font-medium ${isPopular ? "text-neutral-300" : "text-neutral-500 dark:text-neutral-400"}`}
        >
          {plan.name}
        </h3>
        <p
          className={`mt-1 text-xs ${isPopular ? "text-neutral-400" : "text-neutral-400"}`}
        >
          {plan.description}
        </p>
      </div>

      <div className="mt-6">
        <span
          className={`text-4xl font-semibold tracking-tight ${isPopular ? "text-white" : "text-neutral-900 dark:text-foreground"}`}
        >
          ${plan.price}
        </span>
        <span
          className={`ml-1 text-sm ${isPopular ? "text-neutral-400" : "text-neutral-400"}`}
        >
          /{plan.period === "forever" ? "free" : "mo"}
        </span>
      </div>

      <Link
        href={Paths.Login}
        className={`mt-6 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors ${
          isPopular
            ? "bg-white text-neutral-900 hover:bg-neutral-100"
            : "bg-neutral-900 text-white hover:bg-neutral-800"
        }`}
      >
        {plan.cta}
        <IconArrowRight size={14} stroke={2} />
      </Link>

      <ul className="mt-7 flex-1 space-y-3 border-t border-current/10 pt-6">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5">
            <IconCheck
              size={14}
              stroke={2}
              className={`mt-0.5 shrink-0 ${isPopular ? "text-neutral-400" : "text-neutral-400"}`}
            />
            <span
              className={`text-sm ${isPopular ? "text-neutral-300" : "text-neutral-600 dark:text-neutral-400"}`}
            >
              {feature}
            </span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
};

export const Pricing = () => {
  const headerRef = useRef(null);
  const isHeaderInView = useInView(headerRef, { once: true, margin: "-80px" });

  return (
    <section id="pricing" className="landing-section">
      <div className="landing-container">
        {/* Section Header */}
        <motion.div
          ref={headerRef}
          initial={{ opacity: 0, y: 16 }}
          animate={
            isHeaderInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }
          }
          transition={{ duration: 0.4 }}
          className="mb-12"
        >
          <p className="text-xs font-medium uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
            Pricing
          </p>
          <h2 className="mt-3 font-display text-3xl tracking-tight text-neutral-900 dark:text-foreground sm:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mt-3 text-base text-neutral-500 dark:text-neutral-400">
            Start free. Upgrade when you need to. No surprises.
          </p>
        </motion.div>

        {/* Pricing Grid */}
        <div className="grid gap-5 md:grid-cols-3">
          {plans.map((plan, index) => (
            <PricingCard key={plan.id} plan={plan} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
};
