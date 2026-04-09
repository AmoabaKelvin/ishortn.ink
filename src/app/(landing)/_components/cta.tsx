"use client";

import { IconArrowRight } from "@tabler/icons-react";
import { motion, useInView } from "framer-motion";
import { Link } from "next-view-transitions";
import { useRef } from "react";

import { Paths } from "@/lib/constants/app";

export const CTA = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section className="bg-zinc-950 px-6 py-24 md:py-32">
      <div className="mx-auto max-w-6xl">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.5 }}
          className="rounded-2xl border border-zinc-800 bg-zinc-900/50 px-8 py-16 text-center md:px-16 md:py-20"
        >
          <h2 className="font-heading text-3xl font-bold tracking-tight text-zinc-50 md:text-4xl lg:text-5xl">
            Ready to shorten your first link?
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-lg text-zinc-400">
            Join 10,000+ users who trust iShortn for their link management.
            Free to start, no credit card required.
          </p>
          <Link
            href={Paths.Login}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-blue-500 px-8 py-3.5 text-sm font-medium text-white transition-colors hover:bg-blue-600"
          >
            Get started for free
            <IconArrowRight size={16} />
          </Link>
        </motion.div>
      </div>
    </section>
  );
};
