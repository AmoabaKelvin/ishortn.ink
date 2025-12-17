"use client";

import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "next-view-transitions";

import { Paths } from "@/lib/constants/app";

const stats = [
  { value: "10M+", label: "Links Created" },
  { value: "50M+", label: "Clicks Tracked" },
  { value: "99.9%", label: "Uptime" },
];

export const Hero = () => {
  return (
    <section className="relative min-h-screen overflow-hidden pt-32 pb-20">
      {/* Background Elements */}
      <div className="absolute inset-0 landing-gradient-bg" />
      <div className="noise-overlay" />
      <div className="grid-overlay" />

      {/* Gradient Orbs */}
      <div className="gradient-blur -top-40 -right-40 h-96 w-96 bg-amber-200/30" />
      <div className="gradient-blur -bottom-40 -left-40 h-96 w-96 bg-rose-200/20" />
      <div className="gradient-blur top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] bg-neutral-200/40" />

      <div className="landing-container relative z-10">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex justify-center"
        >
          <div className="landing-badge">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span>Trusted by 10,000+ creators & businesses</span>
          </div>
        </motion.div>

        {/* Main Headline */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mt-8 text-center"
        >
          <h1 className="font-display text-5xl leading-[1.1] tracking-tight text-neutral-900 sm:text-6xl md:text-7xl lg:text-8xl">
            Short links.
            <br />
            <span className="relative">
              Big
              <span className="absolute -bottom-2 left-0 right-0 h-3 bg-amber-300/50 -z-10 skew-x-[-12deg]" />
            </span>{" "}
            impact.
          </h1>
        </motion.div>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mx-auto mt-8 max-w-2xl text-center text-lg text-neutral-600 md:text-xl"
        >
          Transform lengthy URLs into powerful branded links. Track every click,
          understand your audience, and grow your business with actionable insights.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <Link href={Paths.Login} className="landing-button-primary group">
            Start for free
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link href="/#features" className="landing-button-secondary">
            See how it works
          </Link>
        </motion.div>

        {/* Social Proof */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-8 flex items-center justify-center gap-3"
        >
          <div className="flex -space-x-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-8 w-8 rounded-full border-2 border-white bg-gradient-to-br from-neutral-200 to-neutral-300"
                style={{
                  backgroundImage: `linear-gradient(135deg, hsl(${i * 40}, 30%, 80%) 0%, hsl(${i * 40}, 30%, 70%) 100%)`,
                }}
              />
            ))}
          </div>
          <p className="text-sm text-neutral-600">
            Join <span className="font-semibold text-neutral-900">10,000+</span> users
          </p>
        </motion.div>

        {/* Stats Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="mt-20 grid grid-cols-3 gap-8 rounded-2xl border border-neutral-200/60 bg-white/60 p-8 backdrop-blur-sm"
        >
          {stats.map((stat, index) => (
            <div key={stat.label} className="text-center">
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.8 + index * 0.1 }}
                className="text-3xl font-semibold text-neutral-900 md:text-4xl"
              >
                {stat.value}
              </motion.div>
              <div className="mt-1 text-sm text-neutral-500">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};
