"use client";

import { ArrowUpRightIcon, CheckIcon, Loader2 } from "lucide-react";

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

const proPlanBenefits = [
  "Custom domains for link shortening",
  "Advanced analytics",
  "Unlimited tracked links",
  "1 year of analytics data retention",
  "Password-protected links",
  "Bulk link creation via CSV",
  "API access",
  "Geotargeting",
  "Priority support",
];

export function UpgradeToPro() {
  const getCheckoutUrlMutation = api.lemonsqueezy.createCheckoutUrl.useMutation();

  const handleUpgrade = async () => {
    try {
      const checkoutUrl = await getCheckoutUrlMutation.mutateAsync();
      checkoutUrl && window.open(checkoutUrl);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          className="flex justify-between py-6"
          variant="outline"
          data-umami-event="Clicked on Upgrade to Pro on Dashboard"
        >
          <div>
            <span className="text-gray-600">Upgrade to</span>
            <span className="mx-2 rounded-md bg-blue-500 px-2 py-1 text-white">PRO</span>
          </div>
          <button className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 bg-white">
            <ArrowUpRightIcon className="h-4 w-4 text-gray-600" />
          </button>
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
                disabled={getCheckoutUrlMutation.isLoading}
                onClick={handleUpgrade}
              >
                {getCheckoutUrlMutation.isLoading && (
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
