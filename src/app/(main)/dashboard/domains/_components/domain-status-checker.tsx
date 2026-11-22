"use client";

import { IconRefresh } from "@tabler/icons-react";
import { useState } from "react";
import { z } from "zod";

import { api } from "@/trpc/react";

import type { RouterOutputs } from "@/trpc/shared";

const domainStatusSchema = z.enum(["pending", "active", "invalid"]);
export type DomainStatus = z.infer<typeof domainStatusSchema>;

type CheckStatusResult = RouterOutputs["customDomain"]["checkStatus"];

interface DomainStatusCheckerProps {
  domain: string;
  onResult: (result: CheckStatusResult) => void;
}

const PENDING_FEEDBACK = "Records not detected yet. DNS changes can take up to 48 hours.";
const IN_REVIEW_FEEDBACK = "This domain is being reviewed. It usually goes live within 24 hours.";

export default function DomainStatusChecker({ domain, onResult }: DomainStatusCheckerProps) {
  // Only shown after a manual check; the 30s background poll stays silent
  const [feedback, setFeedback] = useState<{ tone: "pending" | "error"; message: string } | null>(
    null,
  );

  const checkDomainStatus = api.customDomain.checkStatus.useQuery(
    { domain },
    {
      refetchInterval: 30000,
      retry: false,
      onSuccess: onResult,
    },
  );

  const handleManualCheck = async () => {
    setFeedback(null);
    const { data, error } = await checkDomainStatus.refetch();

    if (!data) {
      setFeedback({
        tone: "error",
        message: error?.message ?? "We couldn't check this domain. Please try again.",
      });
    } else if (data.status !== "active") {
      setFeedback({
        tone: "pending",
        message: data.status === "in_review" ? IN_REVIEW_FEEDBACK : PENDING_FEEDBACK,
      });
    }
  };

  const isLoading = checkDomainStatus.isFetching;

  return (
    <div className="flex min-w-0 flex-col items-end gap-1">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (!isLoading) {
            void handleManualCheck();
          }
        }}
        disabled={isLoading}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium text-blue-600 dark:text-blue-400 transition-colors hover:bg-blue-50 dark:hover:bg-blue-500/10"
      >
        <IconRefresh size={12} stroke={1.5} className={isLoading ? "animate-spin" : ""} />
        {isLoading ? "Checking..." : "Check Now"}
      </button>
      {feedback && !isLoading && (
        <output
          className={`block text-right text-[12px] ${
            feedback.tone === "error"
              ? "text-red-600 dark:text-red-400"
              : "text-amber-700 dark:text-amber-400"
          }`}
        >
          {feedback.message}
        </output>
      )}
    </div>
  );
}
