"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp, CloudOff, Signal, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { revalidateRoute } from "@/app/(main)/dashboard/revalidate-homepage";
import { POSTHOG_EVENTS, trackEvent } from "@/lib/analytics/events";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { daysSinceDate } from "@/lib/utils";
import { api } from "@/trpc/react";

import { DNSRecordsSection } from "./dns-records-section";
import DomainStatusChecker from "./domain-status-checker";

import type { RouterOutputs } from "@/trpc/shared";

type DomainCardProps = {
  domain: RouterOutputs["customDomain"]["list"][0];
};

type VerificationDetails = {
  type: "TXT" | "A" | "CNAME";
  domain: string;
  value: string;
}[];

export function DomainCardNew({ domain }: DomainCardProps) {
  const [status, setStatus] = useState(domain.status);
  const [isExpanded, setIsExpanded] = useState(false);

  // Parse verification challenges
  let verificationChallenges: VerificationDetails = [];
  try {
    verificationChallenges = JSON.parse(
      (domain.verificationDetails as string) ?? "[]"
    ) as VerificationDetails;
  } catch (_error) {
    verificationChallenges = domain.verificationDetails as VerificationDetails;
  }

  // Fetch domain statistics
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

  const handleDelete = () => {
    if (
      window.confirm(
        "Are you sure you want to delete this domain? All associated links will also be deleted."
      )
    ) {
      deleteMutation.mutate({ id: domain.id });
    }
  };

  const daysSinceCreation = daysSinceDate(new Date(domain.createdAt!));
  const canExpand = status === "pending" || status === "invalid";
  const linkCount = stats?.linkCount ?? 0;

  return (
    <Card className="flex flex-col rounded-md overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex flex-col gap-2">
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {domain.domain}
          </span>
          <p className="text-sm text-gray-500 flex items-center gap-1.5">
            <span>
              {daysSinceCreation === 0 ? "Today" : `${daysSinceCreation}d`}
            </span>
            <span className="text-slate-300">•</span>
            <span>
              {linkCount} {linkCount === 1 ? "link" : "links"}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {status === "active" ? (
            <Badge
              variant="outline"
              className="rounded-md py-1 bg-slate-50 font-normal"
            >
              <Signal className="h-4 w-4 mr-1 text-green-600" />
              Connected
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="rounded-md py-1 bg-slate-50 font-normal cursor-pointer hover:bg-slate-100 transition-colors"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <CloudOff className="h-4 w-4 mr-1 text-amber-500" />
              Pending
              {isExpanded ? (
                <ChevronUp className="h-3 w-3 ml-1 text-gray-400" />
              ) : (
                <ChevronDown className="h-3 w-3 ml-1 text-gray-400" />
              )}
            </Badge>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
            disabled={deleteMutation.isLoading}
            className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Expandable DNS Configuration Section */}
      <AnimatePresence initial={false}>
        {canExpand && isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-gray-200 dark:border-gray-800 px-6 py-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
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
    </Card>
  );
}
