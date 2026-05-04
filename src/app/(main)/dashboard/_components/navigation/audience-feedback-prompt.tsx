"use client";

import { IconSparkles } from "@tabler/icons-react";
import { useState } from "react";

import type { Plan } from "@/lib/billing/plans";
import { api } from "@/trpc/react";

import { AudienceFeedbackModal } from "./audience-feedback-modal";

type AudienceFeedbackPromptProps = {
  plan: Plan;
  onTriggerClick?: () => void;
};

export function AudienceFeedbackPrompt({
  plan,
  onTriggerClick,
}: AudienceFeedbackPromptProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { data: status } = api.audienceFeedback.getStatus.useQuery(undefined, {
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  if (!status || status.hasSubmitted) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIsOpen(true);
          onTriggerClick?.();
        }}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-neutral-500 dark:text-neutral-400 transition-colors hover:bg-neutral-50 dark:hover:bg-accent/50 hover:text-neutral-900 dark:hover:text-foreground"
      >
        <IconSparkles size={18} stroke={1.5} className="shrink-0" />
        Help shape iShortn
      </button>
      <AudienceFeedbackModal
        open={isOpen}
        onOpenChange={setIsOpen}
        plan={plan}
      />
    </>
  );
}
