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
    <section id="testimonials" className="bg-zinc-950 px-6 py-24 md:py-32">
      <div className="mx-auto max-w-6xl">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 0.4 }}
        >
          <p className="text-xs font-medium uppercase tracking-widest text-blue-400">
            Testimonials
          </p>
          <h2 className="mt-3 font-heading text-4xl font-bold tracking-tight text-zinc-50 md:text-5xl">
            Trusted by thousands
          </h2>
        </motion.div>

        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <motion.blockquote
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              animate={
                isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }
              }
              transition={{ duration: 0.4, delay: 0.1 + i * 0.1 }}
              className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8"
            >
              <p className="flex-1 text-[15px] leading-relaxed text-zinc-300">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="my-6 h-px bg-zinc-800" />
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 text-sm font-medium text-zinc-400">
                  {t.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-50">{t.name}</p>
                  <p className="text-xs text-zinc-500">{t.role}</p>
                </div>
              </div>
            </motion.blockquote>
          ))}
        </div>
      </div>
    </section>
  );
};
