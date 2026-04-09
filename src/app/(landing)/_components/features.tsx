"use client";

import {
  IconApi,
  IconBolt,
  IconCheck,
  IconSettings,
  IconShieldLock,
} from "@tabler/icons-react";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";

// ---------------------------------------------------------------------------
// Hero Feature 1 – Deep Analytics
// ---------------------------------------------------------------------------

const AnalyticsMock = () => {
  const bars = [40, 65, 55, 80, 60, 90, 72];

  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/50 p-5">
      <p className="text-xs text-zinc-500">Clicks over time</p>
      <p className="mt-1 text-2xl font-bold text-zinc-50">24,847</p>
      <div className="mt-4 flex h-32 items-end gap-1.5">
        {bars.map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm bg-blue-500/80"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        US 42% &middot; UK 18% &middot; DE 14%
      </p>
    </div>
  );
};

const DeepAnalytics = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  const bullets = [
    "Real-time click tracking",
    "Geographic & device breakdown",
    "Referrer source analysis",
  ];

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
      transition={{ duration: 0.5 }}
      className="grid items-center gap-8 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 md:grid-cols-2 md:p-10"
    >
      {/* Text */}
      <div>
        <h3 className="font-heading text-2xl font-bold text-zinc-50 md:text-3xl">
          Deep analytics
        </h3>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Clicks, locations, devices, referrers. Real-time data to drive your
          decisions.
        </p>
        <ul className="mt-6 space-y-3">
          {bullets.map((text) => (
            <li key={text} className="flex items-start gap-3">
              <IconCheck size={16} className="mt-0.5 shrink-0 text-blue-400" />
              <span className="text-sm text-zinc-300">{text}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Visual */}
      <AnalyticsMock />
    </motion.div>
  );
};

// ---------------------------------------------------------------------------
// Hero Feature 2 – Custom Domains & QR Codes
// ---------------------------------------------------------------------------

const DomainQrMock = () => {
  const domains = [
    "links.acme.co",
    "go.startup.io",
    "s.brand.com",
  ];

  // Simple 8x8 QR-like pattern
  const qrPattern = [
    [1, 1, 1, 0, 1, 0, 1, 1],
    [1, 0, 1, 1, 0, 1, 0, 1],
    [1, 1, 1, 0, 1, 1, 1, 0],
    [0, 0, 0, 1, 0, 0, 1, 1],
    [1, 0, 1, 0, 1, 1, 0, 0],
    [0, 1, 1, 1, 0, 1, 1, 1],
    [1, 0, 0, 1, 1, 0, 1, 0],
    [1, 1, 1, 0, 0, 1, 1, 1],
  ];

  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/50 p-5">
      {/* Domain rows */}
      <div>
        {domains.map((domain, i) => (
          <div
            key={domain}
            className={`flex items-center justify-between py-3 ${
              i < domains.length - 1 ? "border-b border-zinc-700/50" : ""
            }`}
          >
            <span className="text-sm text-zinc-50">{domain}</span>
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
          </div>
        ))}
      </div>

      {/* QR code placeholder */}
      <div className="mt-4 inline-grid grid-cols-8 gap-px">
        {qrPattern.flat().map((filled, i) => (
          <div
            key={i}
            className={`h-2 w-2 ${filled ? "bg-zinc-50" : "bg-transparent"}`}
          />
        ))}
      </div>
    </div>
  );
};

const CustomDomainsQr = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  const bullets = [
    "Bring your own domain",
    "Customizable QR codes",
    "Track scans & clicks",
  ];

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="grid items-center gap-8 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 md:grid-cols-2 md:p-10"
    >
      {/* Visual (left on md) */}
      <DomainQrMock />

      {/* Text */}
      <div>
        <h3 className="font-heading text-2xl font-bold text-zinc-50 md:text-3xl">
          Custom domains &amp; QR codes
        </h3>
        <p className="mt-3 leading-relaxed text-zinc-400">
          Use your own domain for branded links. Generate customizable QR codes
          for print and offline.
        </p>
        <ul className="mt-6 space-y-3">
          {bullets.map((text) => (
            <li key={text} className="flex items-start gap-3">
              <IconCheck size={16} className="mt-0.5 shrink-0 text-blue-400" />
              <span className="text-sm text-zinc-300">{text}</span>
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
};

// ---------------------------------------------------------------------------
// Smaller features grid
// ---------------------------------------------------------------------------

const smallFeatures = [
  {
    icon: IconBolt,
    title: "Lightning fast",
    description:
      "Sub-100ms redirects globally. Your links resolve before the blink of an eye.",
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
  {
    icon: IconSettings,
    title: "Link management",
    description:
      "Edit destinations, set expirations, organize with folders. Full control over every link.",
  },
];

const FeatureCard = ({
  feature,
  index,
}: {
  feature: (typeof smallFeatures)[number];
  index: number;
}) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  const Icon = feature.icon;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-6 transition-colors hover:bg-zinc-900/60"
    >
      <Icon size={20} stroke={1.5} className="mb-4 text-zinc-400" />
      <p className="text-sm font-medium text-zinc-50">{feature.title}</p>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">
        {feature.description}
      </p>
    </motion.div>
  );
};

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export const Features = () => {
  const headerRef = useRef(null);
  const isHeaderInView = useInView(headerRef, { once: true, margin: "-80px" });

  return (
    <section id="features" className="bg-zinc-950 px-6 py-24 md:py-32">
      <div className="mx-auto max-w-6xl">
        {/* Section header */}
        <motion.div
          ref={headerRef}
          initial={{ opacity: 0, y: 16 }}
          animate={
            isHeaderInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }
          }
          transition={{ duration: 0.4 }}
        >
          <p className="text-xs font-medium uppercase tracking-widest text-blue-400">
            Features
          </p>
          <h2 className="mt-3 font-heading text-4xl font-bold tracking-tight text-zinc-50 md:text-5xl">
            Everything you need,
            <br />
            nothing you don&apos;t
          </h2>
          <p className="mt-4 max-w-2xl text-lg text-zinc-400">
            Powerful link management tools designed for growth. From analytics to
            custom domains, we&apos;ve got you covered.
          </p>
        </motion.div>

        {/* Hero feature showcases */}
        <div className="mt-16 space-y-12">
          <DeepAnalytics />
          <CustomDomainsQr />
        </div>

        {/* Smaller features grid */}
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-4">
          {smallFeatures.map((feature, index) => (
            <FeatureCard key={feature.title} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
};
