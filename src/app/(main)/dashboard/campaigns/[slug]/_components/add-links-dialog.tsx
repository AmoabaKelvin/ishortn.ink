"use client";

import { IconLink, IconQrcode, IconSearch } from "@tabler/icons-react";
import { useMemo, useState } from "react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

import type { RouterOutputs } from "@/trpc/shared";

type CampaignData = RouterOutputs["campaign"]["get"];

export function AddLinksDialog({
  campaign,
  trigger,
}: {
  campaign: CampaignData;
  trigger: React.ReactNode;
}) {
  const utils = api.useUtils();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [applyUtmDefaults, setApplyUtmDefaults] = useState(campaign.canUseUtmDefaults);

  const memberIds = useMemo(() => new Set(campaign.links.map((l) => l.id)), [campaign.links]);

  const candidatesQuery = api.campaign.linkCandidates.useQuery(undefined, {
    enabled: open,
    refetchOnWindowFocus: false,
  });

  const candidates = useMemo(() => {
    const all = (candidatesQuery.data ?? [])
      .filter((l) => !memberIds.has(l.id))
      .map((l) => ({
        linkId: l.id,
        label: l.name || `${l.domain}/${l.alias ?? ""}`,
        detail: `${l.domain}/${l.alias ?? ""}`,
        isQrCode: l.isQrCode ?? false,
        inOtherCampaign: l.campaignId != null && l.campaignId !== campaign.id,
      }));
    const term = search.trim().toLowerCase();
    if (!term) return all;
    return all.filter(
      (c) => c.label.toLowerCase().includes(term) || c.detail.toLowerCase().includes(term),
    );
  }, [candidatesQuery.data, memberIds, campaign.id, search]);

  const addLinks = api.campaign.addLinks.useMutation({
    onSuccess: (res) => {
      toast.success(`Added ${res.added} ${res.added === 1 ? "link" : "links"} to the campaign.`);
      setOpen(false);
      setSelected(new Set());
      setSearch("");
      void utils.campaign.get.invalidate({ id: campaign.id });
      void utils.campaign.analytics.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const toggle = (linkId: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(linkId)) next.delete(linkId);
      else next.add(linkId);
      return next;
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setSelected(new Set());
          setSearch("");
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add to {campaign.name}</DialogTitle>
          <DialogDescription>
            Pick existing links and QR codes. Their past analytics come with them.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-3">
          <div className="relative">
            <IconSearch
              size={15}
              stroke={1.5}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search links and QR codes…"
              className="pl-9"
            />
          </div>

          <div className="max-h-64 space-y-0.5 overflow-y-auto rounded-lg border border-neutral-200 p-1 dark:border-border">
            {candidatesQuery.isLoading ? (
              <div className="space-y-2 p-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 rounded-md" />
                ))}
              </div>
            ) : candidates.length === 0 ? (
              <p className="p-4 text-center text-[13px] text-neutral-400 dark:text-neutral-500">
                {search
                  ? "Nothing matches your search."
                  : "Everything is already in this campaign."}
              </p>
            ) : (
              candidates.map((candidate) => {
                const checked = selected.has(candidate.linkId);
                return (
                  <button
                    key={candidate.linkId}
                    type="button"
                    onClick={() => toggle(candidate.linkId)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors",
                      checked
                        ? "bg-blue-50 dark:bg-blue-500/10"
                        : "hover:bg-neutral-50 dark:hover:bg-muted",
                    )}
                  >
                    <Checkbox checked={checked} className="pointer-events-none shrink-0" />
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 dark:bg-muted">
                      {candidate.isQrCode ? (
                        <IconQrcode size={14} stroke={1.5} />
                      ) : (
                        <IconLink size={14} stroke={1.5} />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-neutral-900 dark:text-foreground">
                        {candidate.label}
                      </span>
                      <span className="block truncate text-[12px] text-neutral-400 dark:text-neutral-500">
                        {candidate.detail}
                        {candidate.inOtherCampaign && " · moves from another campaign"}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {campaign.canUseUtmDefaults && (
            <label
              htmlFor="apply-utm-defaults"
              className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-neutral-200 p-3 dark:border-border"
            >
              <Checkbox
                id="apply-utm-defaults"
                checked={applyUtmDefaults}
                onCheckedChange={(value) => setApplyUtmDefaults(value === true)}
                className="mt-0.5"
              />
              <span>
                <Label className="cursor-pointer text-[13px]">Apply campaign UTM defaults</Label>
                <p className="mt-0.5 text-[12px] text-neutral-400 dark:text-neutral-500">
                  Sets utm_campaign={campaign.slug}
                  {campaign.utmSource && `, utm_source=${campaign.utmSource}`}
                  {campaign.utmMedium && `, utm_medium=${campaign.utmMedium}`} on the selected
                  links. Source/medium values a link already has are kept; utm_campaign is always
                  updated.
                </p>
              </span>
            </label>
          )}
        </DialogBody>

        <DialogFooter>
          <Button
            onClick={() =>
              addLinks.mutate({
                id: campaign.id,
                linkIds: [...selected],
                applyUtmDefaults: campaign.canUseUtmDefaults && applyUtmDefaults,
              })
            }
            disabled={selected.size === 0 || addLinks.isLoading}
          >
            {addLinks.isLoading
              ? "Adding…"
              : `Add ${selected.size > 0 ? selected.size : ""} ${selected.size === 1 ? "link" : "links"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
