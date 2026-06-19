"use client";

import { ArrowUpRightIcon, CheckIcon, Loader2 } from "lucide-react";

import { trackUpgradeClick } from "@/lib/analytics/upgrade-prompt";
import { PLAN_FEATURES } from "@/lib/billing/plan-features";
import { clientLogger } from "@/lib/logger/client";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { satoshi } from "@/styles/fonts";
import { api } from "@/trpc/react";

const proPlanBenefits = PLAN_FEATURES.pro.features;

export function UpgradeToPro() {
  const upgradeMutation = api.lemonsqueezy.createCheckoutOrUpdate.useMutation();

  const handleUpgrade = async () => {
    try {
      const result = await upgradeMutation.mutateAsync({ plan: "pro" });
      if (result.status === "redirect" && result.url) {
        window.open(result.url);
      } else if (result.status === "updated") {
        window.location.reload();
      }
    } catch (error) {
      clientLogger.error({ err: error }, "upgrade mutation failed");
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          className="flex justify-between py-6"
          variant="outline"
          onClick={() => {
            trackUpgradeClick("upgrade_modal");
          }}
        >
          <div>
            <span className="text-gray-600 dark:text-neutral-400">Upgrade to</span>
            <span className="mx-2 rounded-md bg-blue-500 px-2 py-1 text-white">PRO</span>
          </div>
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 dark:border-border bg-white dark:bg-card">
            <ArrowUpRightIcon className="h-4 w-4 text-gray-600 dark:text-neutral-400" />
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <div className={`space-y-4 ${satoshi.className}`}>
          <DialogHeader>
            <DialogTitle className="text-center text-4xl">iShortn Pro</DialogTitle>
            <DialogDescription>
              Unlock advanced features and support the development of this amazing product.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <h3 className="text-lg font-medium">Benefits of Pro Plan:</h3>
              <ul className="space-y-2 text-muted-foreground">
                {proPlanBenefits.map((benefit) => (
                  <li key={benefit} className="flex items-center gap-2">
                    <CheckIcon className="h-4 w-4 text-green-500" />
                    {benefit}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex w-full gap-2">
              <DialogClose asChild>
                <div className="w-full">
                  <Button variant="outline" className="w-full">
                    Cancel
                  </Button>
                </div>
              </DialogClose>
              <Button
                className="w-full"
                disabled={upgradeMutation.isLoading}
                onClick={handleUpgrade}
              >
                {upgradeMutation.isLoading && (
                  <Loader2 className="mr-2 size-5 animate-spin" />
                )}
                Upgrade Now
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
