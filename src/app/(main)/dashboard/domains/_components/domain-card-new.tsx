"use client";

import {
  IconChevronDown,
  IconClock,
  IconInfoCircle,
  IconLink,
  IconTrash,
} from "@tabler/icons-react";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { revalidateRoute } from "@/app/(main)/dashboard/revalidate-homepage";
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
import { POSTHOG_EVENTS, trackEvent } from "@/lib/analytics/events";
import { daysSinceDate } from "@/lib/utils";
import { api } from "@/trpc/react";

import { DNSRecordsSection } from "./dns-records-section";
import DomainStatusChecker, { type DomainStatus } from "./domain-status-checker";

import type { RouterOutputs } from "@/trpc/shared";

type DomainCardProps = {
  domain: RouterOutputs["customDomain"]["list"][0];
  index: number;
  canManageDomains: boolean;
};

const verificationChallengesSchema = z.array(
  z.object({
    type: z.enum(["TXT", "A", "CNAME"]),
    domain: z.string(),
    fqdn: z.string().optional(),
    value: z.string(),
  }),
);

// The column holds either the challenge array itself or a JSON-encoded copy of
// it, depending on which server path last wrote it.
const storedChallengesSchema = z
  .union([
    verificationChallengesSchema,
    z
      .string()
      .transform((raw, ctx) => {
        try {
          return JSON.parse(raw);
        } catch {
          ctx.addIssue({ code: "custom", message: "Malformed verification details" });
          return z.NEVER;
        }
      })
      .pipe(verificationChallengesSchema),
  ])
  .catch([]);

const STATUS_CONFIG = {
  active: { color: "bg-emerald-500", label: "Active" },
  pending: { color: "bg-amber-500", label: "Pending" },
  invalid: { color: "bg-red-500", label: "Invalid" },
} satisfies Record<DomainStatus, { color: string; label: string }>;

const REVIEW_CONFIG = {
  in_review: {
    color: "bg-amber-500",
    label: "In review",
    icon: IconClock,
    message: "We're reviewing this domain. It usually goes live within 24 hours.",
  },
  rejected: {
    color: "bg-red-500",
    label: "Not approved",
    icon: IconInfoCircle,
    message: "This domain can't be connected. Contact support if you think this is a mistake.",
  },
};

export function DomainCardNew({ domain, index, canManageDomains }: DomainCardProps) {
  const [status, setStatus] = useState(domain.status);
  const [isExpanded, setIsExpanded] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  // Records from the latest status check replace the stored copy, which can be stale
  const [liveChallenges, setLiveChallenges] = useState<z.infer<
    typeof verificationChallengesSchema
  > | null>(null);

  const verificationChallenges =
    liveChallenges ?? storedChallengesSchema.parse(domain.verificationDetails);

  const { data: stats } = api.customDomain.getStats.useQuery(
    { domain: domain.domain! },
    { enabled: !!domain.domain },
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

  const handleStatusResult = async (result: RouterOutputs["customDomain"]["checkStatus"]) => {
    if (result.status === "active") {
      setStatus("active");
      await revalidateRoute("/dashboard/domains");
      return;
    }
    // "in_review" keeps the domain pending until the review finishes
    setStatus("pending");
    if (result.verificationChallenges) setLiveChallenges(result.verificationChallenges);
  };

  const daysSinceCreation = daysSinceDate(new Date(domain.createdAt!));
  const review = domain.review ? REVIEW_CONFIG[domain.review] : null;
  // DNS can be set up while a review runs, but a rejected domain has nothing left to configure
  const canExpand = (status === "pending" || status === "invalid") && domain.review !== "rejected";
  // A rejected domain stays listed: its record is what keeps it from being added again
  const canDelete = canManageDomains && domain.review !== "rejected";
  const linkCount = stats?.linkCount ?? 0;
  const linkCountLabel = `${linkCount.toLocaleString()} ${linkCount === 1 ? "link" : "links"}`;
  const deleteSummary = !stats
    ? `${domain.domain} and all of its links`
    : linkCount > 0
      ? `${domain.domain} and its ${linkCountLabel}`
      : domain.domain;

  const currentStatus = review ?? STATUS_CONFIG[status ?? "pending"];

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
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${currentStatus.color}`} />
                {currentStatus.label}
              </span>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px]">
              <span className="text-neutral-400 dark:text-muted-foreground">
                {daysSinceCreation === 0 ? "Today" : `${daysSinceCreation}d`}
              </span>
              <span className="text-neutral-300 dark:text-muted-foreground">&middot;</span>
              <span className="inline-flex items-center gap-1 tabular-nums text-neutral-500 dark:text-neutral-400">
                <IconLink size={12} stroke={1.5} />
                {linkCountLabel}
              </span>
            </div>

            {review && (
              <p className="mt-1.5 flex items-start gap-1.5 text-[12px] text-neutral-500 dark:text-neutral-400">
                <review.icon size={14} stroke={1.5} className="mt-px shrink-0" />
                {review.message}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-1">
            {canExpand && (
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium text-neutral-500 dark:text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-accent dark:hover:text-neutral-300"
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

            {canDelete && (
              // Hover-revealed only where hover exists; always shown on touch screens
              <button
                type="button"
                onClick={() => setDeleteDialogOpen(true)}
                disabled={deleteMutation.isLoading}
                aria-label={`Delete ${domain.domain}`}
                className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-focus-within:opacity-100 group-hover:opacity-100 dark:text-muted-foreground dark:hover:bg-red-500/10 dark:hover:text-red-400 [@media(hover:none)]:opacity-100"
              >
                <IconTrash size={14} stroke={1.5} />
              </button>
            )}
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
                <div className="mb-4 flex items-start justify-between gap-3">
                  <span className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                    DNS Configuration
                  </span>
                  <DomainStatusChecker domain={domain.domain!} onResult={handleStatusResult} />
                </div>
                <DNSRecordsSection verificationChallenges={verificationChallenges} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-md rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[14px]">Delete domain</AlertDialogTitle>
            <AlertDialogDescription className="break-words text-[12px]">
              This will permanently delete {deleteSummary}.
              {stats?.bioPage &&
                ` The bio page "${stats.bioPage.title || stats.bioPage.slug}" will stop being served on this domain but stays available at its default address.`}{" "}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-9 text-[13px]">Cancel</AlertDialogCancel>
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
