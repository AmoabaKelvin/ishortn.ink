"use client";

import { IconCheck } from "@tabler/icons-react";
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
      className={`relative flex flex-col rounded-2xl border p-8 ${
        isPopular
          ? "border-blue-500/50 bg-zinc-900 ring-1 ring-blue-500/20"
          : "border-zinc-800 bg-zinc-900/50"
      }`}
    >
      {isPopular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-500 px-3 py-1 text-xs font-medium text-white">
          Most popular
        </span>
      )}

      <div>
        <h3 className="text-lg font-medium text-zinc-50">{plan.name}</h3>
        <p className="mt-1 text-sm text-zinc-400">{plan.description}</p>
      </div>

      <div className="mt-6">
        <span className="font-heading text-4xl font-bold text-zinc-50">
          ${plan.price}
        </span>
        <span className="ml-1 text-sm text-zinc-500">
          /{plan.period === "forever" ? "forever" : "month"}
        </span>
      </div>

      <Link
        href={Paths.Login}
        className={`mt-6 block w-full rounded-full py-3 text-center text-sm font-medium transition-all ${
          isPopular
            ? "bg-blue-500 text-white hover:bg-blue-600 transition-colors"
            : "border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-zinc-50"
        }`}
      >
        {plan.cta}
      </Link>

      <div className="my-8 h-px bg-zinc-800" />

      <ul className="flex-1 space-y-3">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5">
            <IconCheck
              size={16}
              stroke={2}
              className={`mt-0.5 shrink-0 ${isPopular ? "text-blue-400" : "text-zinc-600"}`}
            />
            <span className="text-sm text-zinc-400">{feature}</span>
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
    <section id="pricing" className="bg-zinc-950 px-6 py-24 md:py-32">
      <div className="mx-auto max-w-6xl">
        <motion.div
          ref={headerRef}
          initial={{ opacity: 0, y: 16 }}
          animate={
            isHeaderInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }
          }
          transition={{ duration: 0.4 }}
        >
          <p className="text-xs font-medium uppercase tracking-widest text-blue-400">
            Pricing
          </p>
          <h2 className="mt-3 font-heading text-4xl font-bold tracking-tight text-zinc-50 md:text-5xl">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-lg text-zinc-400">
            Start free. Upgrade when you need to. No surprises.
          </p>
        </motion.div>

        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
          {plans.map((plan, index) => (
            <PricingCard key={plan.id} plan={plan} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
};
