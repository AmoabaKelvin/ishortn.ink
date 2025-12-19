"use client";

import { motion, useInView } from "framer-motion";
import { Check, Sparkles, X, Zap } from "lucide-react";
import { Link } from "next-view-transitions";
import { useRef } from "react";

import { Paths } from "@/lib/constants/app";

const plans = [
  {
    id: "free",
    name: "Free",
    description: "Perfect for getting started",
    price: 0,
    period: "forever",
    features: [
      "30 links per month",
      "1,000 tracked events",
      "7 days analytics history",
      "Basic link customization",
      "Standard support",
    ],
    limitations: ["No custom domains", "No folders", "Limited analytics"],
    cta: "Get Started",
    popular: false,
  },
  {
    id: "pro",
    name: "Pro",
    description: "For creators & small teams",
    price: 5,
    period: "per month",
    features: [
      "1,000 links per month",
      "10,000 tracked events",
      "Unlimited analytics history",
      "3 custom domains",
      "5 folders",
      "Priority support",
      "API access",
    ],
    cta: "Start Free Trial",
    popular: true,
  },
  {
    id: "ultra",
    name: "Ultra",
    description: "For teams & power users",
    price: 15,
    period: "per month",
    features: [
      "Unlimited links",
      "Unlimited tracked events",
      "Unlimited custom domains",
      "Unlimited folders",
      "Dedicated support",
      "Full API access",
      "Advanced analytics",
    ],
    comingSoon: [
      "Team collaboration",
      "Device targeting",
      "Geo targeting",
    ],
    cta: "Contact Sales",
    popular: false,
  },
];

const PricingCard = ({
  plan,
  index,
}: {
  plan: (typeof plans)[0];
  index: number;
}) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const isPopular = plan.popular;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.5, delay: index * 0.15 }}
      className={`relative overflow-hidden rounded-3xl border p-8 transition-all duration-500 hover:-translate-y-1 ${
        isPopular
          ? "border-neutral-900 bg-neutral-900 text-white shadow-2xl shadow-neutral-900/30"
          : "border-neutral-200/60 bg-white hover:shadow-2xl hover:shadow-neutral-900/10"
      }`}
    >
      {/* Popular Badge */}
      {isPopular && (
        <div className="absolute -right-12 top-8 rotate-45 bg-amber-400 px-12 py-1 text-xs font-semibold text-neutral-900">
          POPULAR
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <h3 className={`text-xl font-semibold ${isPopular ? "text-white" : "text-neutral-900"}`}>
            {plan.name}
          </h3>
          {isPopular && <Sparkles className="h-5 w-5 text-amber-400" />}
        </div>
        <p className={`mt-1 text-sm ${isPopular ? "text-neutral-400" : "text-neutral-500"}`}>
          {plan.description}
        </p>
      </div>

      {/* Price */}
      <div className="mb-8">
        <div className="flex items-baseline gap-1">
          <span className={`text-sm ${isPopular ? "text-neutral-400" : "text-neutral-500"}`}>$</span>
          <span className={`text-5xl font-bold tracking-tight ${isPopular ? "text-white" : "text-neutral-900"}`}>
            {plan.price}
          </span>
        </div>
        <p className={`mt-1 text-sm ${isPopular ? "text-neutral-400" : "text-neutral-500"}`}>
          {plan.period}
        </p>
      </div>

      {/* CTA */}
      <Link
        href={Paths.Login}
        className={`mb-8 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-medium transition-all ${
          isPopular
            ? "bg-white text-neutral-900 hover:bg-neutral-100"
            : "bg-neutral-900 text-white hover:bg-neutral-800"
        }`}
      >
        {isPopular && <Zap className="h-4 w-4" />}
        {plan.cta}
      </Link>

      {/* Features */}
      <div>
        <p className={`mb-4 text-sm font-medium ${isPopular ? "text-neutral-300" : "text-neutral-700"}`}>
          {plan.id === "free" ? "Includes:" : `Everything in ${plan.id === "pro" ? "Free" : "Pro"}, plus:`}
        </p>
        <ul className="space-y-3">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-3">
              <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                isPopular ? "bg-white/10" : "bg-neutral-100"
              }`}>
                <Check className={`h-3 w-3 ${isPopular ? "text-amber-400" : "text-neutral-600"}`} />
              </div>
              <span className={`text-sm ${isPopular ? "text-neutral-300" : "text-neutral-600"}`}>
                {feature}
              </span>
            </li>
          ))}
        </ul>

        {/* Coming Soon Features */}
        {plan.comingSoon && plan.comingSoon.length > 0 && (
          <>
            <div className="my-6 flex items-center gap-3">
              <div className={`h-px flex-1 ${isPopular ? "bg-white/10" : "bg-neutral-200"}`} />
              <span className={`text-xs uppercase tracking-wider ${isPopular ? "text-neutral-500" : "text-neutral-400"}`}>
                Coming Soon
              </span>
              <div className={`h-px flex-1 ${isPopular ? "bg-white/10" : "bg-neutral-200"}`} />
            </div>
            <ul className="space-y-3">
              {plan.comingSoon.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                    isPopular ? "bg-white/5" : "bg-neutral-50"
                  }`}>
                    <Check className={`h-3 w-3 ${isPopular ? "text-neutral-500" : "text-neutral-400"}`} />
                  </div>
                  <span className={`text-sm ${isPopular ? "text-neutral-500" : "text-neutral-400"}`}>
                    {feature}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        {/* Limitations */}
        {plan.limitations && (
          <div className="mt-6 pt-6 border-t border-neutral-200/60">
            <ul className="space-y-2">
              {plan.limitations.map((limitation) => (
                <li key={limitation} className="flex items-center gap-2 text-sm text-neutral-400">
                  <X className="h-3 w-3" />
                  {limitation}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export const Pricing = () => {
  const headerRef = useRef(null);
  const isHeaderInView = useInView(headerRef, { once: true, margin: "-100px" });

  return (
    <section id="pricing" className="landing-section relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-neutral-50/50 via-white to-neutral-50/50" />
      <div className="noise-overlay" />

      {/* Decorative Elements */}
      <div className="gradient-blur -top-20 left-1/4 h-72 w-72 bg-amber-200/20" />
      <div className="gradient-blur -bottom-20 right-1/4 h-72 w-72 bg-rose-200/20" />

      <div className="landing-container relative z-10">
        {/* Section Header */}
        <motion.div
          ref={headerRef}
          initial={{ opacity: 0, y: 20 }}
          animate={isHeaderInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.5 }}
          className="mb-16 text-center"
        >
          <div className="landing-badge mx-auto mb-6">
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            <span>Simple Pricing</span>
          </div>
          <h2 className="font-display text-4xl tracking-tight text-neutral-900 sm:text-5xl">
            Plans for every stage
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-neutral-600">
            Start free and scale as you grow. No hidden fees, no surprises.
            Cancel anytime.
          </p>
        </motion.div>

        {/* Pricing Grid */}
        <div className="grid gap-8 lg:grid-cols-3">
          {plans.map((plan, index) => (
            <PricingCard key={plan.id} plan={plan} index={index} />
          ))}
        </div>

        {/* FAQ Link */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-12 text-center text-sm text-neutral-500"
        >
          Have questions?{" "}
          <a href="/#faq" className="text-neutral-900 underline underline-offset-4 hover:text-neutral-700">
            Check our FAQ
          </a>{" "}
          or{" "}
          <a href="mailto:support@ishortn.ink" className="text-neutral-900 underline underline-offset-4 hover:text-neutral-700">
            contact us
          </a>
        </motion.p>
      </div>
    </section>
  );
};
