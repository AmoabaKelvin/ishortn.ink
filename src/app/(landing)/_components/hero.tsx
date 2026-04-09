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
    original: "https://www.example-store.com/products/summer-collection?utm_source=email&utm_medium=newsletter",
    short: "ishortn.ink/summer24",
    clicks: "12,493",
  },
  {
    original: "https://figma.com/design/abc123/Brand-Guidelines?node-id=0%3A1&t=xyz",
    short: "ishortn.ink/brand",
    clicks: "891",
  },
];

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: "easeOut" },
});

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
    <div className="mx-auto mt-16 w-full max-w-3xl md:mt-20" style={{ minHeight: 250 }}>
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 md:p-8">
        {/* Window chrome */}
        <div className="mb-5 flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
          <div className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
          <div className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
          <span className="ml-3 text-[11px] text-zinc-500">ishortn.ink</span>
        </div>

        {/* Input area */}
        <div className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div
                key="placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex h-6 items-center"
              >
                <span className="text-sm text-zinc-500">
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
                <span className="truncate text-sm text-zinc-300">
                  {demo.original}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Result */}
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
                <div className="flex items-center justify-between rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-emerald-400" />
                    <span className="text-sm font-medium text-blue-400">
                      {demo.short}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-zinc-500">
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

                {/* Quick stats */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.15 }}
                  className="mt-3 flex items-center gap-4 px-1"
                >
                  <span className="text-xs text-zinc-500">
                    {demo.clicks} clicks
                  </span>
                  <span className="text-xs text-zinc-600">&middot;</span>
                  <span className="text-xs text-zinc-500">24 countries</span>
                  <span className="text-xs text-zinc-600">&middot;</span>
                  <span className="text-xs text-zinc-500">Live analytics</span>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export const Hero = () => {
  return (
    <section className="bg-zinc-950 px-6 pt-32 pb-20 md:pt-40 md:pb-28">
      <div className="mx-auto max-w-6xl">
        {/* Headline */}
        <motion.h1
          {...fadeUp(0)}
          className="font-heading text-5xl font-extrabold tracking-tight text-zinc-50 leading-[1.05] md:text-6xl lg:text-[5.5rem]"
        >
          Short links that
          <br className="hidden md:block" />
          <span className="md:hidden"> </span>
          track every click
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          {...fadeUp(0.1)}
          className="mt-6 max-w-xl text-lg leading-relaxed text-zinc-400 md:text-xl"
        >
          Create branded short links with powerful analytics. Track clicks,
          understand your audience, and grow with data.
        </motion.p>

        {/* CTA row */}
        <motion.div
          {...fadeUp(0.2)}
          className="mt-10 flex items-center gap-4"
        >
          <Link
            href={Paths.Login}
            className="group inline-flex items-center gap-2 rounded-full bg-blue-500 px-7 py-3.5 text-sm font-medium text-white transition-colors hover:bg-blue-600"
          >
            Start for free
            <IconArrowRight
              size={15}
              stroke={2}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </Link>
          <Link
            href="/#features"
            className="rounded-full border border-zinc-700 px-7 py-3.5 text-sm font-medium text-zinc-400 transition-all hover:border-zinc-500 hover:text-zinc-50"
          >
            See how it works
          </Link>
        </motion.div>

        <motion.p {...fadeUp(0.2)} className="mt-4 text-xs text-zinc-500">
          No credit card required
        </motion.p>

        {/* Interactive Demo */}
        <motion.div {...fadeUp(0.3)}>
          <DemoAnimation />
        </motion.div>

        {/* Social Proof Stats */}
        <motion.div
          {...fadeUp(0.4)}
          className="mt-16 flex items-center justify-center gap-12 md:gap-16"
        >
          <div className="text-center">
            <div className="font-heading text-2xl font-bold text-zinc-50">
              10M+
            </div>
            <div className="mt-1 text-sm text-zinc-500">links created</div>
          </div>
          <div className="h-8 w-px bg-zinc-800" />
          <div className="text-center">
            <div className="font-heading text-2xl font-bold text-zinc-50">
              50M+
            </div>
            <div className="mt-1 text-sm text-zinc-500">clicks tracked</div>
          </div>
          <div className="h-8 w-px bg-zinc-800" />
          <div className="text-center">
            <div className="font-heading text-2xl font-bold text-zinc-50">
              99.9%
            </div>
            <div className="mt-1 text-sm text-zinc-500">uptime</div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
