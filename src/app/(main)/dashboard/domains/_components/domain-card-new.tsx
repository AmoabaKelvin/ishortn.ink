"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  IconChevronDown,
  IconLink,
  IconTrash,
} from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { revalidateRoute } from "@/app/(main)/dashboard/revalidate-homepage";
import { POSTHOG_EVENTS, trackEvent } from "@/lib/analytics/events";
import { daysSinceDate } from "@/lib/utils";
import { api } from "@/trpc/react";

import { DNSRecordsSection } from "./dns-records-section";
import DomainStatusChecker from "./domain-status-checker";

import type { RouterOutputs } from "@/trpc/shared";

type DomainCardProps = {
  domain: RouterOutputs["customDomain"]["list"][0];
  index: number;
};

type VerificationDetails = {
  type: "TXT" | "A" | "CNAME";
  domain: string;
  value: string;
}[];

export function DomainCardNew({ domain, index }: DomainCardProps) {
  const [status, setStatus] = useState(domain.status);
  const [isExpanded, setIsExpanded] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  let verificationChallenges: VerificationDetails = [];
  try {
    verificationChallenges = JSON.parse(
      (domain.verificationDetails as string) ?? "[]"
    ) as VerificationDetails;
  } catch (_error) {
    verificationChallenges = domain.verificationDetails as VerificationDetails;
  }

  const { data: stats } = api.customDomain.getStats.useQuery(
    { domain: domain.domain! },
    { enabled: !!domain.domain }
  );

  const deleteMutation = api.customDomain.delete.useMutation({
    onSuccess: async () => {
      toast.success("Domain deleted successfully");
      trackEvent(POSTHOG_EVENTS.CUSTOM_DOMAIN_DELETED, {
        domain: domain.domain,
      });
      await revalidateRoute("/dashboard/domains");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleStatusChange = async (
    newStatus: "pending" | "active" | "invalid"
  ) => {
    setStatus(newStatus);
    if (newStatus === "active" || newStatus === "invalid") {
      await revalidateRoute("/dashboard/domains");
    }
  };

  const daysSinceCreation = daysSinceDate(new Date(domain.createdAt!));
  const canExpand = status === "pending" || status === "invalid";
  const linkCount = stats?.linkCount ?? 0;

  const statusConfig = {
    active: { color: "bg-emerald-500", label: "Active" },
    pending: { color: "bg-amber-500", label: "Pending" },
    invalid: { color: "bg-red-500", label: "Invalid" },
  };

  const currentStatus =
    statusConfig[status as keyof typeof statusConfig] ?? statusConfig.pending;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.2, delay: index * 0.04 }}
    >
      <div className="group px-1 py-4">
        <div className="flex items-center gap-3">
          {/* Content */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-[14px] font-medium text-neutral-900 dark:text-foreground">
                {domain.domain}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${currentStatus.color}`}
                />
                {currentStatus.label}
              </span>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px]">
              <span className="text-neutral-400 dark:text-neutral-500">
                {daysSinceCreation === 0
                  ? "Today"
                  : `${daysSinceCreation}d`}
              </span>
              <span className="text-neutral-300">&middot;</span>
              <span className="inline-flex items-center gap-1 text-neutral-500 dark:text-neutral-400">
                <IconLink size={12} stroke={1.5} />
                {linkCount} {linkCount === 1 ? "link" : "links"}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-1">
            {canExpand && (
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium text-neutral-500 dark:text-neutral-400 transition-colors hover:bg-neutral-100 dark:hover:bg-accent hover:text-neutral-700"
              >
                <span>DNS</span>
                <motion.div
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <IconChevronDown size={12} stroke={1.5} />
                </motion.div>
              </button>
            )}

            <button
              type="button"
              onClick={() => setDeleteDialogOpen(true)}
              disabled={deleteMutation.isLoading}
              className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 dark:text-neutral-500 opacity-0 transition-all hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 group-hover:opacity-100"
            >
              <IconTrash size={14} stroke={1.5} />
            </button>
          </div>
        </div>

        {/* Expandable DNS Configuration */}
        <AnimatePresence initial={false}>
          {canExpand && isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="mt-4 rounded-lg border border-neutral-200 dark:border-border p-4">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                    DNS Configuration
                  </span>
                  <DomainStatusChecker
                    domain={domain.domain!}
                    initialStatus={status}
                    onStatusChange={handleStatusChange}
                  />
                </div>
                <DNSRecordsSection
                  verificationChallenges={verificationChallenges}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-md rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[14px]">
              Delete domain
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[12px]">
              This will permanently delete {domain.domain} and all associated
              links. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-9 text-[13px]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate({ id: domain.id })}
              className="h-9 bg-red-600 text-[13px] hover:bg-red-700"
            >
              {deleteMutation.isLoading ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
