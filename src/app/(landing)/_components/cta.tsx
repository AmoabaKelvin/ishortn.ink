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
    <section className="px-6 py-24 md:py-32">
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.5 }}
        className="mx-auto max-w-5xl rounded-2xl bg-neutral-900 px-8 py-16 text-center md:px-16 md:py-20"
      >
        <h2 className="font-display text-3xl tracking-tight text-white sm:text-4xl md:text-5xl">
          Ready to shorten
          <br />
          your first link?
        </h2>
        <p className="mx-auto mt-4 max-w-md text-base text-neutral-400">
          Join 10,000+ users who trust iShortn for their link management.
          Free to start, no credit card required.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href={Paths.Login}
            className="group inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-100"
          >
            Get started for free
            <IconArrowRight size={14} stroke={2} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </motion.div>
    </section>
  );
};
