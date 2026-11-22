"use client";

import { IconSpeakerphone } from "@tabler/icons-react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

import { POSTHOG_EVENTS, trackEvent } from "@/lib/analytics/events";

import { AcquisitionForm } from "./acquisition-form";

import type { Plan } from "@/lib/billing/plans";

const CARD_EASE = [0.32, 0.72, 0, 1] as const;

export function AcquisitionPromptCard({ plan }: { plan: Plan }) {
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    trackEvent(POSTHOG_EVENTS.ACQUISITION_PROMPT_SHOWN, { source: "dashboard", plan });
  }, [plan]);

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.section
          key="acquisition-prompt-card"
          aria-labelledby="acquisition-prompt-title"
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3, ease: CARD_EASE }}
          className="overflow-hidden"
        >
          <div className="pb-6">
            <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-border dark:bg-card">
              <div className="mb-4 flex items-start gap-3">
                <div className="shrink-0 rounded-lg bg-neutral-100 p-2 dark:bg-muted">
                  <IconSpeakerphone
                    size={18}
                    stroke={1.5}
                    className="text-neutral-700 dark:text-neutral-300"
                  />
                </div>
                <div className="min-w-0">
                  <h3
                    id="acquisition-prompt-title"
                    className="text-[14px] font-medium text-neutral-900 dark:text-foreground"
                  >
                    How did you find iShortn?
                  </h3>
                  <p className="mt-0.5 text-[13px] text-neutral-500 dark:text-neutral-400">
                    Two quick questions that help us reach more people like you.
                  </p>
                </div>
              </div>
              <AcquisitionForm
                source="dashboard"
                plan={plan}
                variant="card"
                onDone={() => setIsOpen(false)}
              />
            </div>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
