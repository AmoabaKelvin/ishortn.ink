"use client";

import {
  IconApi,
  IconBolt,
  IconChartBar,
  IconPalette,
  IconQrcode,
  IconShieldLock,
} from "@tabler/icons-react";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";

import type { Icon } from "@tabler/icons-react";

const features: { icon: Icon; title: string; description: string }[] = [
  {
    icon: IconBolt,
    title: "Lightning fast",
    description:
      "Sub-100ms redirects globally. Your links resolve before the blink of an eye.",
  },
  {
    icon: IconChartBar,
    title: "Deep analytics",
    description:
      "Clicks, locations, devices, referrers. Real-time data to drive your decisions.",
  },
  {
    icon: IconPalette,
    title: "Custom domains",
    description:
      "Use your own domain for branded links that build trust and recognition.",
  },
  {
    icon: IconQrcode,
    title: "QR codes",
    description:
      "Generate customizable QR codes for any link. Perfect for print and offline.",
  },
  {
    icon: IconApi,
    title: "Developer API",
    description:
      "RESTful API with full documentation. Integrate link shortening into your stack.",
  },
  {
    icon: IconShieldLock,
    title: "Password protection",
    description:
      "Secure sensitive links with passwords. Control exactly who sees your content.",
  },
];

const FeatureRow = ({
  feature,
  index,
}: {
  feature: (typeof features)[number];
  index: number;
}) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const FeatureIcon = feature.icon;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="group grid grid-cols-1 gap-4 border-b border-neutral-100 dark:border-border/50 py-8 last:border-0 md:grid-cols-12 md:items-center md:gap-8"
    >
      <div className="flex items-center gap-4 md:col-span-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-100 dark:bg-muted text-neutral-600 dark:text-neutral-400 transition-colors group-hover:bg-neutral-900 dark:group-hover:bg-foreground group-hover:text-white dark:group-hover:text-background">
          <FeatureIcon size={20} stroke={1.5} />
        </div>
        <h3 className="text-base font-medium text-neutral-900 dark:text-foreground">
          {feature.title}
        </h3>
      </div>
      <p className="text-[15px] leading-relaxed text-neutral-500 dark:text-neutral-400 md:col-span-7">
        {feature.description}
      </p>
    </motion.div>
  );
};

const AnalyticsPreview = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  const bars = [35, 52, 78, 65, 89, 72, 95, 82, 68, 91, 76, 88];
  const countries = [
    { name: "United States", pct: 42 },
    { name: "United Kingdom", pct: 18 },
    { name: "Germany", pct: 14 },
    { name: "Canada", pct: 11 },
    { name: "France", pct: 8 },
  ];

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
      transition={{ duration: 0.5 }}
      className="mt-20 overflow-hidden rounded-xl border border-neutral-200 dark:border-border bg-white dark:bg-card"
    >
      {/* Window chrome */}
      <div className="flex items-center gap-2 border-b border-neutral-100 dark:border-border/50 px-5 py-3">
        <div className="h-2.5 w-2.5 rounded-full bg-neutral-200 dark:bg-accent" />
        <div className="h-2.5 w-2.5 rounded-full bg-neutral-200 dark:bg-accent" />
        <div className="h-2.5 w-2.5 rounded-full bg-neutral-200 dark:bg-accent" />
        <span className="ml-3 text-[11px] text-neutral-400 dark:text-neutral-500">
          Analytics Dashboard
        </span>
      </div>

      <div className="p-6 md:p-8">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-6 border-b border-neutral-100 dark:border-border/50 pb-6">
          {[
            { label: "Total clicks", value: "24,847" },
            { label: "Unique visitors", value: "18,293" },
            { label: "Top country", value: "US (42%)" },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-[11px] uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                {stat.label}
              </p>
              <p className="mt-1 text-lg font-semibold text-neutral-900 dark:text-foreground md:text-xl">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Chart + geo */}
        <div className="mt-6 grid gap-8 md:grid-cols-12">
          {/* Bar chart */}
          <div className="md:col-span-7">
            <p className="mb-4 text-xs font-medium uppercase tracking-wider text-neutral-400">
              Clicks over time
            </p>
            <div className="flex items-end gap-1.5" style={{ height: 120 }}>
              {bars.map((height, i) => (
                <motion.div
                  key={i}
                  initial={{ height: 0 }}
                  animate={isInView ? { height: `${height}%` } : { height: 0 }}
                  transition={{ duration: 0.4, delay: 0.3 + i * 0.04 }}
                  className="flex-1 rounded-sm bg-neutral-900"
                />
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-neutral-300 dark:text-neutral-600">
              <span>Jan</span>
              <span>Jun</span>
              <span>Dec</span>
            </div>
          </div>

          {/* Countries */}
          <div className="md:col-span-5">
            <p className="mb-4 text-xs font-medium uppercase tracking-wider text-neutral-400">
              Top locations
            </p>
            <div className="space-y-3">
              {countries.map((country) => (
                <div key={country.name} className="flex items-center gap-3">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-neutral-100 dark:bg-muted">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={
                        isInView
                          ? { width: `${country.pct}%` }
                          : { width: 0 }
                      }
                      transition={{ duration: 0.5, delay: 0.5 }}
                      className="h-full rounded-full bg-neutral-900"
                    />
                  </div>
                  <span className="w-28 shrink-0 text-xs text-neutral-500 dark:text-neutral-400">
                    {country.name}
                  </span>
                  <span className="w-8 shrink-0 text-right text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    {country.pct}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export const Features = () => {
  const headerRef = useRef(null);
  const isHeaderInView = useInView(headerRef, { once: true, margin: "-80px" });

  return (
    <section id="features" className="landing-section">
      <div className="landing-container">
        {/* Section Header */}
        <motion.div
          ref={headerRef}
          initial={{ opacity: 0, y: 16 }}
          animate={
            isHeaderInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }
          }
          transition={{ duration: 0.4 }}
          className="mb-4"
        >
          <p className="text-xs font-medium uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
            Features
          </p>
          <h2 className="mt-3 font-display text-3xl tracking-tight text-neutral-900 dark:text-foreground sm:text-4xl">
            Everything you need,
            <br />
            nothing you don&apos;t
          </h2>
        </motion.div>

        {/* Feature list */}
        <div className="mt-8">
          {features.map((feature, index) => (
            <FeatureRow key={feature.title} feature={feature} index={index} />
          ))}
        </div>

        {/* Analytics preview */}
        <AnalyticsPreview />
      </div>
    </section>
  );
};
