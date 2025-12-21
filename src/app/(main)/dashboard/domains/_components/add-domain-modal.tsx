"use client";

import { Globe, Lightbulb, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { revalidateRoute } from "@/app/(main)/dashboard/revalidate-homepage";
import { POSTHOG_EVENTS, trackEvent } from "@/lib/analytics/events";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { satoshi } from "@/styles/fonts";
import { api } from "@/trpc/react";

export function AddCustomDomainModal() {
  const { data: userSubscription } = api.subscriptions.get.useQuery();

  const [domain, setDomain] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const createCustomDomainMutation = api.customDomain.create.useMutation({
    onSuccess: async () => {
      toast.success("Domain added successfully");
      trackEvent(POSTHOG_EVENTS.CUSTOM_DOMAIN_ADDED, {
        domain,
      });
      setDomain("");
      setIsOpen(false);
      await revalidateRoute("/dashboard/domains");
    },
  });
  const createCheckoutMutation =
    api.lemonsqueezy.createCheckoutOrUpdate.useMutation({
      onSuccess: async (data) => {
        if (data.status === "redirect" && data.url) {
          window.location.href = data.url;
        }
      },
    });

  const handleDomainChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDomain(e.target.value);
  };

  const handleUpgrade = async () => {
    toast.promise(createCheckoutMutation.mutateAsync({ plan: "pro" }), {
      loading: "Creating checkout session...",
      success: "Checkout session created successfully",
      error: "Failed to create checkout session",
    });
  };

  const handleCreateDomain = () => {
    if (!domain) {
      return;
    }

    toast.promise(createCustomDomainMutation.mutateAsync({ domain }), {
      loading: "Adding domain...",
      success: "Domain added successfully",
      error: "Failed to add domain",
    });
  };

  const isProUser = userSubscription?.subscriptions?.status === "active";

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          {isProUser ? "Add Domain" : "Upgrade to Add Domain"}
        </Button>
      </DialogTrigger>
      <DialogContent className={cn("sm:max-w-[425px]", satoshi.className)}>
        <DialogHeader>
          <DialogTitle>Add domain</DialogTitle>
          <DialogDescription>
            Add a new custom domain for your account.
          </DialogDescription>
        </DialogHeader>
        {isProUser ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="domain" className="text-sm font-medium text-gray-700">
                Domain
              </Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="domain"
                  className="pl-10"
                  placeholder="links.example.com"
                  value={domain}
                  onChange={handleDomainChange}
                />
              </div>
            </div>
            <div className="flex items-start gap-2.5 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2.5">
              <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700">
                Use a subdomain like <span className="font-medium">links.example.com</span> if your main domain already has content.
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-amber-50 border border-amber-100 px-4 py-3 text-center">
            <p className="text-sm text-amber-700">
              Custom domains are available on the Pro plan.
            </p>
          </div>
        )}
        <DialogFooter>
          {isProUser ? (
            <Button
              type="submit"
              className="mt-3 w-full"
              onClick={handleCreateDomain}
              disabled={!domain || createCustomDomainMutation.isLoading}
            >
              Add Domain
            </Button>
          ) : (
            <Button
              type="button"
              className="mt-3 w-full"
              onClick={handleUpgrade}
            >
              Upgrade to Pro
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
