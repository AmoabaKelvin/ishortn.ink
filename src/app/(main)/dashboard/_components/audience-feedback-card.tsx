"use client";

import { IconSpeakerphone } from "@tabler/icons-react";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

import { api } from "@/trpc/react";

import { AudienceFeedbackModal } from "./navigation/audience-feedback-modal";

type AudienceFeedbackCardProps = {
  hasLinks: boolean;
};

const CARD_EASE = [0.32, 0.72, 0, 1] as const;

export function AudienceFeedbackCard({ hasLinks }: AudienceFeedbackCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const utils = api.useUtils();

  const { data: status } = api.audienceFeedback.getStatus.useQuery(undefined, {
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const { data: subscription } = api.subscriptions.get.useQuery(undefined, {
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const plan = subscription?.plan ?? "free";

  const dismissMutation = api.audienceFeedback.dismiss.useMutation({
    onSuccess: () => {
      void utils.audienceFeedback.getStatus.invalidate();
    },
  });

  const shouldShow =
    hasLinks &&
    status !== undefined &&
    !status.hasSubmitted &&
    status.shouldAutoPrompt;

  return (
    <>
      <AnimatePresence initial={false}>
        {shouldShow && (
          <motion.div
            key="audience-feedback-card"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: CARD_EASE }}
            className="overflow-hidden"
          >
            <div className="mt-6 flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-5 dark:border-border dark:bg-card sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="shrink-0 rounded-lg bg-neutral-100 p-2 dark:bg-muted">
                  <IconSpeakerphone
                    size={18}
                    stroke={1.5}
                    className="text-neutral-700 dark:text-neutral-300"
                  />
                </div>
                <div>
                  <h3 className="text-[14px] font-medium text-neutral-900 dark:text-foreground">
                    Help shape iShortn
                  </h3>
                  <p className="mt-0.5 text-[13px] text-neutral-500 dark:text-neutral-400">
                    A quick survey on how you use iShortn — takes about 30
                    seconds.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:shrink-0">
                <button
                  type="button"
                  onClick={() => dismissMutation.mutate()}
                  disabled={dismissMutation.isLoading}
                  className="px-2 py-1 text-[13px] text-neutral-500 transition-colors hover:text-neutral-900 disabled:opacity-50 dark:text-neutral-400 dark:hover:text-foreground"
                >
                  Not now
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-neutral-800 dark:bg-foreground dark:text-background dark:hover:bg-foreground/90"
                >
                  Share feedback
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AudienceFeedbackModal
        open={isOpen}
        onOpenChange={setIsOpen}
        plan={plan}
      />
    </>
  );
}
