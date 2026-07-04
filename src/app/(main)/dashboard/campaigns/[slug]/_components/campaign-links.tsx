"use client";

import { IconExternalLink, IconLink, IconPlus, IconQrcode, IconX } from "@tabler/icons-react";
import { motion } from "framer-motion";
import { Link } from "next-view-transitions";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import type { RouterOutputs } from "@/trpc/shared";

import { AddLinksDialog } from "./add-links-dialog";

type CampaignData = RouterOutputs["campaign"]["get"];

export function CampaignLinks({ campaign }: { campaign: CampaignData }) {
  const utils = api.useUtils();

  const removeLink = api.campaign.removeLink.useMutation({
    onSuccess: () => {
      toast.success("Removed from campaign. The link itself was kept.");
      void utils.campaign.get.invalidate({ id: campaign.id });
      void utils.campaign.analytics.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-neutral-400 dark:text-neutral-500">
          {campaign.links.length === 0
            ? "Attach existing links and QR codes, or create new ones inside this campaign."
            : "Clicks and scans from these links roll up into the campaign."}
        </p>
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/link/new?campaignId=${campaign.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-[13px] font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-border dark:text-foreground dark:hover:bg-muted"
          >
            <IconPlus size={14} stroke={2} />
            Create link
          </Link>
          <AddLinksDialog
            campaign={campaign}
            trigger={
              <button className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-[13px] font-medium text-white transition-[background-color,transform] hover:bg-blue-700 active:scale-[0.97]">
                <IconPlus size={14} stroke={2} />
                Add links
              </button>
            }
          />
        </div>
      </div>

      {campaign.links.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200 py-14 text-center dark:border-border">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-400 dark:bg-muted">
            <IconLink size={22} stroke={1.5} />
          </span>
          <h3 className="mt-4 text-[15px] font-medium text-neutral-900 dark:text-foreground">
            No links in this campaign
          </h3>
          <p className="mt-1 max-w-sm text-[13px] text-neutral-400 dark:text-neutral-500">
            Add your Instagram, newsletter, flyer QR, and ad links here to compare how each channel
            performs.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-neutral-200/70 dark:divide-border">
          {campaign.links.map((memberLink, index) => {
            const shortUrl = `${memberLink.domain}/${memberLink.alias ?? ""}`;
            const channel = memberLink.utmParams?.utm_source;
            return (
              <motion.div
                key={memberLink.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: Math.min(index, 6) * 0.04,
                  type: "spring",
                  duration: 0.4,
                  bounce: 0,
                }}
                className="flex items-center justify-between gap-4 py-3.5"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 dark:bg-muted">
                    {memberLink.isQrCode ? (
                      <IconQrcode size={16} stroke={1.5} />
                    ) : (
                      <IconLink size={16} stroke={1.5} />
                    )}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[14px] font-medium text-neutral-900 dark:text-foreground">
                        {memberLink.name || shortUrl}
                      </span>
                      {channel && (
                        <span className="shrink-0 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:bg-violet-500/10 dark:text-violet-400">
                          {channel}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-[12px] text-neutral-400 dark:text-neutral-500">
                      {shortUrl}
                      {memberLink.url && ` → ${memberLink.url}`}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-[13px] font-medium tabular-nums text-neutral-900 dark:text-foreground">
                    {memberLink.clicks.toLocaleString()}
                    <span className="ml-1 text-[11px] font-normal text-neutral-400">
                      {memberLink.isQrCode ? "scans" : "clicks"}
                    </span>
                  </span>
                  <a
                    href={`https://${shortUrl}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open short link"
                    title="Open short link"
                    className="rounded-md p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-muted"
                  >
                    <IconExternalLink size={15} stroke={1.5} />
                  </a>
                  <button
                    aria-label="Remove from campaign"
                    title="Remove from campaign"
                    onClick={() =>
                      removeLink.mutate({ id: campaign.id, linkId: memberLink.id })
                    }
                    className="rounded-md p-2 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                  >
                    <IconX size={15} stroke={1.5} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
