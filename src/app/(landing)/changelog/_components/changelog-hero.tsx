"use client";

import { motion } from "framer-motion";

export function ChangelogHero() {
  return (
    <section className="bg-zinc-950 px-6 pt-32 pb-16 md:pt-40 md:pb-20">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <p className="text-xs font-medium uppercase tracking-widest text-blue-400">
            Changelog
          </p>
          <h1 className="mt-4 font-heading text-5xl font-extrabold leading-[1.05] tracking-tight text-zinc-50 md:text-6xl lg:text-[5.5rem]">
            What&apos;s new
            <br />
            at iShortn
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400 md:text-xl">
            Shipping updates, improvements, and fixes. Everything we ship,
            in one place.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
