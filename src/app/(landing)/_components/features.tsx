"use client";

import { motion, useInView } from "framer-motion";
import {
  BarChart3,
  Blocks,
  Globe,
  Link2,
  Palette,
  QrCode,
  Shield,
  Zap,
} from "lucide-react";
import { useRef } from "react";

const features = [
  {
    icon: Zap,
    title: "Lightning Fast",
    description:
      "Create short links instantly. Our infrastructure delivers sub-100ms redirects globally.",
    color: "bg-amber-500",
  },
  {
    icon: BarChart3,
    title: "Deep Analytics",
    description:
      "Track clicks, locations, devices, and referrers. Make data-driven decisions with real-time insights.",
    color: "bg-blue-500",
  },
  {
    icon: Palette,
    title: "Custom Branding",
    description:
      "Use your own domain. Create memorable, branded links that build trust and recognition.",
    color: "bg-rose-500",
  },
  {
    icon: QrCode,
    title: "QR Codes",
    description:
      "Generate beautiful QR codes for any link. Perfect for print materials and offline campaigns.",
    color: "bg-purple-500",
  },
  {
    icon: Blocks,
    title: "Developer API",
    description:
      "RESTful API with comprehensive documentation. Integrate link shortening into your apps seamlessly.",
    color: "bg-green-500",
  },
  {
    icon: Shield,
    title: "Password Protection",
    description:
      "Secure sensitive links with passwords. Control who can access your shared content.",
    color: "bg-orange-500",
  },
];

const FeatureCard = ({
  feature,
  index,
}: {
  feature: (typeof features)[0];
  index: number;
}) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="feature-card group"
    >
      {/* Icon */}
      <div
        className={`mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl ${feature.color} text-white shadow-lg transition-transform duration-300 group-hover:scale-110`}
      >
        <feature.icon className="h-7 w-7" />
      </div>

      {/* Content */}
      <h3 className="mb-3 text-xl font-semibold text-neutral-900">
        {feature.title}
      </h3>
      <p className="leading-relaxed text-neutral-600">{feature.description}</p>

      {/* Decorative corner */}
      <div className="absolute -bottom-12 -right-12 h-32 w-32 rounded-full bg-neutral-100/50 transition-transform duration-500 group-hover:scale-150" />
    </motion.div>
  );
};

export const Features = () => {
  const headerRef = useRef(null);
  const isHeaderInView = useInView(headerRef, { once: true, margin: "-100px" });

  return (
    <section id="features" className="landing-section relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-neutral-50/50 to-white" />
      <div className="noise-overlay" />

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
            <Globe className="h-3.5 w-3.5 text-blue-500" />
            <span>Powerful Features</span>
          </div>
          <h2 className="font-display text-4xl tracking-tight text-neutral-900 sm:text-5xl">
            Everything you need to
            <br />
            <span className="relative inline-block">
              grow your reach
              <svg
                className="absolute -bottom-2 left-0 w-full"
                viewBox="0 0 200 8"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M2 6C50 2 150 2 198 6"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  className="text-amber-400"
                />
              </svg>
            </span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-600">
            From simple link shortening to advanced analytics and custom branding,
            we have all the tools you need to make every link count.
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <FeatureCard key={feature.title} feature={feature} index={index} />
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5 }}
          className="mt-16 flex flex-col items-center justify-center gap-4 rounded-3xl border border-neutral-200/60 bg-gradient-to-r from-neutral-50 to-white p-12 text-center sm:flex-row"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-900 text-white">
              <Link2 className="h-6 w-6" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-neutral-900">
                Ready to supercharge your links?
              </p>
              <p className="text-sm text-neutral-500">
                Start free, upgrade anytime
              </p>
            </div>
          </div>
          <a
            href="/auth/sign-up"
            className="landing-button-primary whitespace-nowrap"
          >
            Get started free
          </a>
        </motion.div>
      </div>
    </section>
  );
};
