"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

export function ChangelogHero() {
  return (
    <section className="relative overflow-hidden px-4 pb-16 pt-32">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-amber-50/40 via-white to-rose-50/30" />
      <div className="noise-overlay" />

      {/* Decorative elements */}
      <div className="absolute -left-20 top-20 h-72 w-72 rounded-full bg-gradient-to-br from-amber-200/20 to-orange-200/20 blur-3xl" />
      <div className="absolute -right-20 top-40 h-72 w-72 rounded-full bg-gradient-to-br from-rose-200/20 to-pink-200/20 blur-3xl" />

      <div className="relative z-10 mx-auto max-w-4xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="landing-badge mx-auto mb-8">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span>What&apos;s New</span>
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="font-display text-5xl tracking-tight text-neutral-900 sm:text-6xl md:text-7xl"
        >
          Changelog
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mx-auto mt-6 max-w-2xl text-lg text-neutral-600 sm:text-xl"
        >
          New features, improvements, and fixes. Stay up to date with everything
          we&apos;re building to make your links work harder.
        </motion.p>

        {/* Decorative line */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
          className="mx-auto mt-12 h-px w-32 bg-gradient-to-r from-transparent via-neutral-300 to-transparent"
        />
      </div>
    </section>
  );
}
