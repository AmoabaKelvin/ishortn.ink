"use client";

import { IconDownload, IconLock } from "@tabler/icons-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { UpgradeCta } from "@/components/upgrade-cta";
import { formatPromoEnd } from "@/lib/billing/promo";
import { api } from "@/trpc/react";

import { useUpgradeOffer } from "../../_components/upgrade-offer";

import type { RouterInputs } from "@/trpc/shared";

type ExportClicksButtonProps = {
  isProPlan: boolean;
  /** Everything the page used to load its clicks: range, filter and, on per-link analytics, the link. */
  query: RouterInputs["link"]["exportClicks"];
  /** File name without the extension. */
  fileName: string;
};

const BUTTON_CLASS =
  "h-9 gap-1.5 border-neutral-200 bg-white px-3 text-[13px] text-neutral-700 dark:border-border dark:bg-card dark:text-neutral-300";

export function ExportClicksButton({ isProPlan, query, fileName }: ExportClicksButtonProps) {
  const promo = useUpgradeOffer();
  const exportClicks = api.link.exportClicks.useMutation({
    onSuccess: ({ csv, rowCount, truncated }) => {
      if (rowCount === 0) {
        toast.info("No clicks in this date range to export.");
        return;
      }
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${fileName}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);

      if (truncated) {
        toast.warning(
          `Exported the latest ${rowCount.toLocaleString()} clicks. Pick a shorter date range to export older ones.`,
        );
      } else {
        toast.success(
          `Exported ${rowCount.toLocaleString()} ${rowCount === 1 ? "click" : "clicks"}`,
        );
      }
    },
    onError: (error) => toast.error(error.message),
  });

  if (!isProPlan) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button asChild variant="outline" className={BUTTON_CLASS}>
              <UpgradeCta
                requiredPlan="pro"
                source="analytics_export"
                promo={promo}
                aria-label="Export CSV is a Pro feature. Upgrade to Pro"
              >
                <IconLock
                  size={14}
                  stroke={1.5}
                  className="text-neutral-400 dark:text-muted-foreground"
                />
                Export CSV
              </UpgradeCta>
            </Button>
          </TooltipTrigger>
          <TooltipContent className="text-[12px]">
            {promo
              ? `Export raw clicks with Pro. ${promo.percentOff}% off your first year until ${formatPromoEnd(promo.endsAt)}.`
              : "Upgrade to Pro to export raw clicks"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      className={BUTTON_CLASS}
      disabled={exportClicks.isLoading}
      onClick={() => exportClicks.mutate(query)}
    >
      <IconDownload
        size={14}
        stroke={1.5}
        className="text-neutral-400 dark:text-muted-foreground"
      />
      {exportClicks.isLoading ? "Exporting..." : "Export CSV"}
    </Button>
  );
}
