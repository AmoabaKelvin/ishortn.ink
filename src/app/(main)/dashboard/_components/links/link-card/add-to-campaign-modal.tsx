"use client";

import { IconLoader2 } from "@tabler/icons-react";
import { useTransitionRouter } from "next-view-transitions";
import { useId, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/trpc/react";

type AddToCampaignModalProps = {
  linkId: number;
  currentCampaignId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AddToCampaignModal({
  linkId,
  currentCampaignId,
  open,
  onOpenChange,
}: AddToCampaignModalProps) {
  const router = useTransitionRouter();
  const utils = api.useUtils();
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [applyUtmDefaults, setApplyUtmDefaults] = useState(true);
  const applyUtmDefaultsId = useId();

  const { data: campaigns, isLoading } = api.campaign.listNames.useQuery(undefined, {
    enabled: open,
  });
  const { data: subscription } = api.subscriptions.get.useQuery(undefined, {
    enabled: open,
  });
  const isProUser = (subscription?.plan ?? "free") !== "free";

  const isMove = currentCampaignId != null;
  const currentCampaign = campaigns?.find((campaign) => campaign.id === currentCampaignId);
  const options = campaigns?.filter((campaign) => campaign.id !== currentCampaignId) ?? [];
  const selectedCampaign = options.find(
    (campaign) => campaign.id.toString() === selectedCampaignId,
  );

  const addLinksMutation = api.campaign.addLinks.useMutation({
    onSuccess: async () => {
      toast.success(isMove ? "Link moved to campaign" : "Link added to campaign");
      await utils.link.list.invalidate();
      void utils.campaign.get.invalidate();
      void utils.campaign.analytics.invalidate();
      router.refresh();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setTimeout(() => {
        setSelectedCampaignId("");
        setApplyUtmDefaults(true);
      }, 300);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{isMove ? "Move to campaign" : "Add to campaign"}</DialogTitle>
          <DialogDescription>
            {isMove && currentCampaign
              ? `Currently in ${currentCampaign.name}. Pick a new campaign.`
              : "Pick a campaign for this link. Its past analytics come with it."}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
              Campaign
            </Label>
            {!isLoading && options.length === 0 ? (
              <p className="rounded-lg border border-neutral-200 dark:border-border p-3 text-[13px] text-neutral-400 dark:text-neutral-500">
                No active campaigns to pick from. Create one from the Campaigns page first.
              </p>
            ) : (
              <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
                <SelectTrigger className="h-9 border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px]">
                  <SelectValue placeholder={isLoading ? "Loading..." : "Select a campaign"} />
                </SelectTrigger>
                <SelectContent>
                  {options.map((campaign) => (
                    <SelectItem key={campaign.id} value={campaign.id.toString()}>
                      {campaign.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {isProUser && selectedCampaign && (
            <label
              htmlFor={applyUtmDefaultsId}
              className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-neutral-200 p-3 dark:border-border"
            >
              <Checkbox
                id={applyUtmDefaultsId}
                checked={applyUtmDefaults}
                onCheckedChange={(value) => setApplyUtmDefaults(value === true)}
                className="mt-0.5"
              />
              <span>
                <Label className="cursor-pointer text-[13px]">Apply campaign UTM defaults</Label>
                <p className="mt-0.5 text-[12px] text-neutral-400 dark:text-neutral-500">
                  Stamps utm_campaign={selectedCampaign.slug}
                  {selectedCampaign.utmSource && `, utm_source=${selectedCampaign.utmSource}`}
                  {selectedCampaign.utmMedium && `, utm_medium=${selectedCampaign.utmMedium}`} onto
                  this link. Source/medium values the link already has are kept; utm_campaign is
                  always updated.
                </p>
              </span>
            </label>
          )}
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            className="h-9 text-[13px]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() =>
              addLinksMutation.mutate({
                id: Number(selectedCampaignId),
                linkIds: [linkId],
                applyUtmDefaults: isProUser && applyUtmDefaults,
              })
            }
            disabled={!selectedCampaign || addLinksMutation.isLoading}
            className="h-9 bg-blue-600 text-[13px] hover:bg-blue-700"
          >
            {addLinksMutation.isLoading ? (
              <>
                <IconLoader2 size={14} stroke={1.5} className="mr-1.5 animate-spin" />
                {isMove ? "Moving..." : "Adding..."}
              </>
            ) : isMove ? (
              "Move"
            ) : (
              "Add"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
