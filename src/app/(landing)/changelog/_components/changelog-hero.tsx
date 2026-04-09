"use client";

import { motion } from "framer-motion";

export function ChangelogHero() {
  return (
    <section className="px-6 pt-32 pb-12 md:pt-40 md:pb-16">
      <div className="mx-auto max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <p className="text-xs font-medium uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
            Changelog
          </p>
          <h1 className="mt-3 font-display text-4xl tracking-tight text-neutral-900 dark:text-foreground sm:text-5xl">
            What&apos;s new
          </h1>
          <p className="mt-3 text-base text-neutral-500 dark:text-neutral-400">
            New features, improvements, and fixes. Everything we ship.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
