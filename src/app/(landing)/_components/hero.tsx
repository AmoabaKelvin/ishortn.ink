"use client";

import { IconArrowRight, IconCheck, IconCopy } from "@tabler/icons-react";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "next-view-transitions";
import { useEffect, useState } from "react";

import { Paths } from "@/lib/constants/app";

const demoLinks = [
  {
    original: "https://docs.google.com/spreadsheets/d/1a2b3c4d5e/edit?usp=sharing",
    short: "ishortn.ink/q3-report",
    clicks: "2,847",
  },
  {
    original: "https://www.example.com/products/summer-collection?utm_source=email&utm_medium=newsletter",
    short: "ishortn.ink/summer24",
    clicks: "12,493",
  },
  {
    original: "https://app.figma.com/file/abc123/Brand-Guidelines?node-id=0%3A1&t=xyz",
    short: "ishortn.ink/brand",
    clicks: "891",
  },
];

const DemoAnimation = () => {
  const [step, setStep] = useState(0);
  const [currentLink, setCurrentLink] = useState(0);

  useEffect(() => {
    const sequence = [
      () => setStep(1),
      () => setStep(2),
      () => setStep(3),
    ];

    const timeouts: NodeJS.Timeout[] = [];
    let delay = 1200;

    sequence.forEach((fn, i) => {
      timeouts.push(setTimeout(fn, delay));
      delay += i === 0 ? 1800 : 1400;
    });

    const cycleTimeout = setTimeout(() => {
      setStep(0);
      setCurrentLink((prev) => (prev + 1) % demoLinks.length);
    }, delay + 400);
    timeouts.push(cycleTimeout);

    return () => timeouts.forEach(clearTimeout);
  }, [currentLink]);

  const demo = demoLinks[currentLink]!;

  return (
    <div className="mx-auto mt-16 w-full max-w-2xl" style={{ minHeight: 250 }}>
      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
        {/* Window chrome */}
        <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3">
          <div className="h-2.5 w-2.5 rounded-full bg-neutral-200" />
          <div className="h-2.5 w-2.5 rounded-full bg-neutral-200" />
          <div className="h-2.5 w-2.5 rounded-full bg-neutral-200" />
          <span className="ml-3 text-[11px] text-neutral-400">
            ishortn.ink
          </span>
        </div>

        <div className="p-6">
          {/* Input area */}
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
            <AnimatePresence mode="wait">
              {step === 0 && (
                <motion.div
                  key="placeholder"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex h-6 items-center"
                >
                  <span className="text-sm text-neutral-400">
                    Paste your long URL here...
                  </span>
                </motion.div>
              )}
              {step >= 1 && (
                <motion.div
                  key="url"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex h-6 items-center"
                >
                  <span className="truncate text-sm text-neutral-700">
                    {demo.original}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Result - overflow hidden on outer card clips the expand, minHeight reserves space outside */}
          <AnimatePresence>
            {step >= 2 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <div className="pt-4">
                  <div className="flex items-center justify-between rounded-lg border border-neutral-900 bg-neutral-900 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-emerald-400" />
                      <span className="text-sm font-medium text-white">
                        {demo.short}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-neutral-400">
                      {step === 3 ? (
                        <motion.div
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="flex items-center gap-1.5 text-emerald-400"
                        >
                          <IconCheck size={14} stroke={2} />
                          <span className="text-xs">Copied</span>
                        </motion.div>
                      ) : (
                        <>
                          <IconCopy size={14} stroke={1.5} />
                          <span className="text-xs">Copy</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Quick stats preview */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.15 }}
                    className="mt-3 flex items-center gap-4 px-1"
                  >
                    <span className="text-xs text-neutral-400">
                      {demo.clicks} clicks
                    </span>
                    <span className="text-xs text-neutral-300">|</span>
                    <span className="text-xs text-neutral-400">
                      24 countries
                    </span>
                    <span className="text-xs text-neutral-300">|</span>
                    <span className="text-xs text-neutral-400">
                      Live analytics
                    </span>
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export const Hero = () => {
  return (
    <section className="relative overflow-hidden px-6 pt-32 pb-20 md:pt-40 md:pb-28">
      <div className="mx-auto max-w-5xl">
        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-center"
        >
          <h1 className="font-display text-5xl leading-[1.08] tracking-tight text-neutral-900 sm:text-6xl md:text-7xl">
            The URL Shortener
            <br />
            That Tracks Every Click
          </h1>
        </motion.div>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mx-auto mt-6 max-w-lg text-center text-base leading-relaxed text-neutral-500 md:text-lg"
        >
          Create short links with powerful analytics and custom domains.
          Track clicks, understand your audience, and grow your brand.
        </motion.p>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <Link
            href={Paths.Login}
            className="group inline-flex items-center gap-2 rounded-full bg-neutral-900 px-7 py-3 text-sm font-medium text-white transition-all hover:bg-neutral-800"
          >
            Start for free
            <IconArrowRight size={14} stroke={2} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
          <span className="text-xs text-neutral-400">
            No credit card required
          </span>
        </motion.div>

        {/* Interactive Demo */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <DemoAnimation />
        </motion.div>

        {/* Social proof - understated */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="mt-16 flex items-center justify-center gap-8 text-xs text-neutral-400 md:gap-12"
        >
          <span>
            <strong className="font-medium text-neutral-600">10M+</strong> links
            created
          </span>
          <span className="hidden h-3 w-px bg-neutral-200 sm:block" />
          <span>
            <strong className="font-medium text-neutral-600">50M+</strong> clicks
            tracked
          </span>
          <span className="hidden h-3 w-px bg-neutral-200 sm:block" />
          <span>
            <strong className="font-medium text-neutral-600">99.9%</strong>{" "}
            uptime
          </span>
        </motion.div>
      </div>
    </section>
  );
};
