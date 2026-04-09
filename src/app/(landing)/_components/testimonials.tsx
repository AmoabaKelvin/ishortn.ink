"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const testimonials = [
  {
    quote:
      "This tool is a godsend. I am using the link shortener and the QR code generator. It does everything I need it to.",
    name: "FixatedManufacturing",
    role: "Small Business Owner",
  },
  {
    quote:
      "We pasted posters around town using the QR codes and now we know which ones perform best. It has really helped us grow.",
    name: "Plamagandalla",
    role: "Marketing Team",
  },
  {
    quote:
      "Looks awesome. Minimalist and accurate. Exactly what I was looking for. Clean interface, fast redirects, and the analytics are spot on.",
    name: "Anonymous",
    role: "Developer",
  },
];

export const Testimonials = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="testimonials" className="landing-section">
      <div className="landing-container">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 0.4 }}
          className="mb-12"
        >
          <p className="text-xs font-medium uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
            Testimonials
          </p>
          <h2 className="mt-3 font-display text-3xl tracking-tight text-neutral-900 dark:text-foreground sm:text-4xl">
            Trusted by thousands
          </h2>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <motion.blockquote
              key={t.name}
              initial={{ opacity: 0, y: 16 }}
              animate={
                isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }
              }
              transition={{ duration: 0.4, delay: 0.1 + i * 0.08 }}
              className="flex flex-col rounded-xl border border-neutral-100 dark:border-border/50 p-6"
            >
              <p className="flex-1 text-[15px] leading-relaxed text-neutral-600 dark:text-neutral-400">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="mt-5 flex items-center gap-3 border-t border-neutral-100 dark:border-border/50 pt-5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 dark:bg-muted text-xs font-medium text-neutral-600 dark:text-neutral-400">
                  {t.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-900 dark:text-foreground">
                    {t.name}
                  </p>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500">{t.role}</p>
                </div>
              </div>
            </motion.blockquote>
          ))}
        </div>
      </div>
    </section>
  );
};
