"use client";

import {
  IconArchive,
  IconArchiveOff,
  IconPlus,
  IconSpeakerphone,
  IconTrash,
} from "@tabler/icons-react";
import { motion } from "framer-motion";
import { Link } from "next-view-transitions";
import { useRouter } from "next/navigation";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { notifyPlanLimit } from "@/lib/analytics/upgrade-prompt";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

import { CampaignStateBadge } from "./campaign-state-badge";
import { CreateCampaignDialog } from "./create-campaign-dialog";

import type { Plan } from "@/lib/billing/plans";
import type { RouterOutputs } from "@/trpc/shared";

type Campaigns = RouterOutputs["campaign"]["list"];

type CampaignsListProps = {
  campaigns: Campaigns;
  plan: Plan;
  campaignLimit: number | null;
};

// UTC to match how campaign dates are stored (see campaign-settings.tsx).
const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function formatDateRange(start: Date | null, end: Date | null): string | null {
  if (start && end) return `${dateFmt.format(start)} – ${dateFmt.format(end)}`;
  if (start) return `From ${dateFmt.format(start)}`;
  if (end) return `Until ${dateFmt.format(end)}`;
  return null;
}

export function CampaignsList({ campaigns, campaignLimit }: CampaignsListProps) {
  const router = useRouter();
  const utils = api.useUtils();
  const [view, setView] = useState<"active" | "archived">("active");

  const activeCampaigns = campaigns.filter((c) => c.status === "active");
  const archivedCampaigns = campaigns.filter((c) => c.status === "archived");
  // Fall back to "active" when the last archived campaign is restored or
  // deleted, so the user isn't stranded on an empty view with no switcher.
  const effectiveView = archivedCampaigns.length === 0 ? "active" : view;
  const visible = effectiveView === "active" ? activeCampaigns : archivedCampaigns;
  const atLimit = campaignLimit !== null && activeCampaigns.length >= campaignLimit;

  const deleteCampaign = api.campaign.delete.useMutation({
    onSuccess: () => {
      toast.success("Campaign deleted. Its links were kept.");
      void utils.campaign.listNames.invalidate();
      router.refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  const updateCampaign = api.campaign.update.useMutation({
    onSuccess: (_, variables) => {
      toast.success(variables.status === "archived" ? "Campaign archived." : "Campaign restored.");
      void utils.campaign.listNames.invalidate();
      router.refresh();
    },
    onError: (error, variables) => {
      if (error.data?.code === "FORBIDDEN" && variables.status === "active") {
        notifyPlanLimit(error.message, "campaign_unarchive");
      } else {
        toast.error(error.message);
      }
    },
  });

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-foreground">
            Campaigns
          </h2>
          <p className="mt-1 text-[13px] text-neutral-400 dark:text-neutral-500">
            Group links and QR codes behind one initiative and see which channel wins.
          </p>
        </div>

        {campaigns.length > 0 && <NewCampaignButton atLimit={atLimit} />}
      </div>

      {archivedCampaigns.length > 0 && (
        <div className="mb-4 inline-flex items-center gap-1 rounded-lg border border-neutral-200 p-1 dark:border-border">
          {(["active", "archived"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setView(tab)}
              className={cn(
                "rounded-md px-2.5 py-1 text-[12px] font-medium capitalize transition-colors",
                effectiveView === tab
                  ? "bg-neutral-900 text-white dark:bg-foreground dark:text-background"
                  : "text-neutral-500 hover:text-neutral-800 dark:hover:text-foreground",
              )}
            >
              {tab} ({tab === "active" ? activeCampaigns.length : archivedCampaigns.length})
            </button>
          ))}
        </div>
      )}

      {campaigns.length === 0 ? (
        <EmptyState />
      ) : visible.length === 0 ? (
        <p className="py-20 text-center text-[13px] text-neutral-400 dark:text-neutral-500">
          No {effectiveView} campaigns.
        </p>
      ) : (
        <div className="divide-y divide-neutral-200/70 dark:divide-border">
          {visible.map((campaign, index) => {
            const range = formatDateRange(campaign.startDate, campaign.endDate);
            const isArchived = campaign.status === "archived";
            return (
              <motion.div
                key={campaign.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: Math.min(index, 6) * 0.05,
                  type: "spring",
                  duration: 0.4,
                  bounce: 0,
                }}
                className="flex items-center justify-between gap-4 py-4"
              >
                <Link
                  href={`/dashboard/campaigns/${campaign.slug}`}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 dark:bg-muted">
                    <IconSpeakerphone size={18} stroke={1.5} />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[14px] font-medium text-neutral-900 dark:text-foreground">
                        {campaign.name}
                      </span>
                      <CampaignStateBadge state={campaign.displayState} />
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] tabular-nums text-neutral-400 dark:text-neutral-500">
                      {campaign.linkCount} {campaign.linkCount === 1 ? "link" : "links"}
                      {campaign.qrCount > 0 &&
                        ` · ${campaign.qrCount} QR ${campaign.qrCount === 1 ? "code" : "codes"}`}
                      {" · "}
                      {campaign.totalClicks.toLocaleString()}{" "}
                      {campaign.totalClicks === 1 ? "click" : "clicks"}
                      {range && ` · ${range}`}
                    </span>
                  </span>
                </Link>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    aria-label={isArchived ? "Restore campaign" : "Archive campaign"}
                    title={isArchived ? "Restore campaign" : "Archive campaign"}
                    className="rounded-md p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-muted"
                    onClick={() =>
                      updateCampaign.mutate({
                        id: campaign.id,
                        status: isArchived ? "active" : "archived",
                      })
                    }
                  >
                    {isArchived ? (
                      <IconArchiveOff size={16} stroke={1.5} />
                    ) : (
                      <IconArchive size={16} stroke={1.5} />
                    )}
                  </button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        aria-label="Delete campaign"
                        title="Delete campaign"
                        className="rounded-md p-2 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                      >
                        <IconTrash size={16} stroke={1.5} />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this campaign?</AlertDialogTitle>
                        <AlertDialogDescription>
                          The campaign and its analytics view are removed. Its links and QR codes
                          are kept — they just leave the campaign.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-red-600 hover:bg-red-700"
                          onClick={() => deleteCampaign.mutate({ id: campaign.id })}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NewCampaignButton({ atLimit }: { atLimit: boolean }) {
  if (atLimit) {
    return (
      <span
        className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg bg-neutral-100 px-4 py-2 text-[13px] font-medium text-neutral-400 dark:bg-muted dark:text-neutral-500"
        title="You've reached your plan's active campaign limit. Archive one or upgrade."
      >
        <IconPlus size={16} stroke={2} />
        New campaign
      </span>
    );
  }
  return (
    <CreateCampaignDialog
      trigger={
        <button className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white transition-[background-color,transform] hover:bg-blue-700 active:scale-[0.97]">
          <IconPlus size={16} stroke={2} />
          New campaign
        </button>
      }
    />
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200 py-16 text-center dark:border-border">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-400 dark:bg-muted">
        <IconSpeakerphone size={22} stroke={1.5} />
      </span>
      <h3 className="mt-4 text-[15px] font-medium text-neutral-900 dark:text-foreground">
        Run your first campaign
      </h3>
      <p className="mt-1 max-w-sm text-[13px] text-neutral-400 dark:text-neutral-500">
        A campaign groups the links and QR codes behind one launch, event, or push — with combined
        analytics and per-channel comparison.
      </p>
      <div className="mt-5">
        <CreateCampaignDialog
          trigger={
            <button className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white transition-[background-color,transform] hover:bg-blue-700 active:scale-[0.97]">
              <IconPlus size={16} stroke={2} />
              New campaign
            </button>
          }
        />
      </div>
    </div>
  );
}
