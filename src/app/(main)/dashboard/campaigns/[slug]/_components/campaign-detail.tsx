"use client";

import {
  IconArchive,
  IconArchiveOff,
  IconArrowLeft,
  IconDotsVertical,
  IconTrash,
} from "@tabler/icons-react";
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
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { notifyPlanLimit } from "@/lib/analytics/upgrade-prompt";
import { api } from "@/trpc/react";

import { CampaignStateBadge } from "../../_components/campaign-state-badge";
import { CampaignLinks } from "./campaign-links";
import { CampaignOverview } from "./campaign-overview";
import { CampaignSettings } from "./campaign-settings";

import type { Plan } from "@/lib/billing/plans";
import type { RouterOutputs } from "@/trpc/shared";

type CampaignData = RouterOutputs["campaign"]["get"];

// Dates are stored as UTC day boundaries — format in UTC so they don't drift
// a day for users west of UTC.
const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

type CampaignDetailProps = {
  campaignId: number;
  initialData: CampaignData;
  plan: Plan;
};

export function CampaignDetail({ campaignId, initialData, plan }: CampaignDetailProps) {
  const router = useRouter();
  const utils = api.useUtils();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: campaign } = api.campaign.get.useQuery(
    { id: campaignId },
    { initialData, refetchOnWindowFocus: false },
  );

  const updateCampaign = api.campaign.update.useMutation({
    onSuccess: (_, variables) => {
      toast.success(variables.status === "archived" ? "Campaign archived." : "Campaign restored.");
      void utils.campaign.get.invalidate({ id: campaignId });
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

  const deleteCampaign = api.campaign.delete.useMutation({
    onSuccess: () => {
      toast.success("Campaign deleted. Its links were kept.");
      void utils.campaign.listNames.invalidate();
      router.push("/dashboard/campaigns");
    },
    onError: (error) => toast.error(error.message),
  });

  const isArchived = campaign.status === "archived";
  const dateRange =
    campaign.startDate && campaign.endDate
      ? `${dateFmt.format(campaign.startDate)} – ${dateFmt.format(campaign.endDate)}`
      : campaign.startDate
        ? `From ${dateFmt.format(campaign.startDate)}`
        : campaign.endDate
          ? `Until ${dateFmt.format(campaign.endDate)}`
          : null;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/campaigns"
            className="rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-muted"
          >
            <IconArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-foreground">
                {campaign.name}
              </h2>
              <CampaignStateBadge state={campaign.displayState} />
            </div>
            <p className="text-[12px] text-neutral-400 dark:text-neutral-500">
              utm_campaign={campaign.slug}
              {dateRange && ` · ${dateRange}`}
            </p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="Campaign actions"
              className="rounded-md p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-muted"
            >
              <IconDotsVertical size={16} stroke={1.5} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() =>
                updateCampaign.mutate({
                  id: campaign.id,
                  status: isArchived ? "active" : "archived",
                })
              }
            >
              {isArchived ? (
                <>
                  <IconArchiveOff size={14} className="mr-2" /> Restore campaign
                </>
              ) : (
                <>
                  <IconArchive size={14} className="mr-2" /> Archive campaign
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600"
              onClick={() => setConfirmDelete(true)}
            >
              <IconTrash size={14} className="mr-2" /> Delete campaign
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="links">
            Links{campaign.links.length > 0 && ` (${campaign.links.length})`}
          </TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent
          value="overview"
          className="mt-5 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1"
        >
          <CampaignOverview campaign={campaign} plan={plan} />
        </TabsContent>

        <TabsContent
          value="links"
          className="mt-5 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1"
        >
          <CampaignLinks campaign={campaign} />
        </TabsContent>

        <TabsContent
          value="settings"
          className="mt-5 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1"
        >
          <CampaignSettings campaign={campaign} plan={plan} />
        </TabsContent>
      </Tabs>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              The campaign and its analytics view are removed. Its links and QR codes are kept —
              they just leave the campaign.
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
  );
}
