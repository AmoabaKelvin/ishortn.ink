"use client";

import { IconInfoCircle, IconPlus, IconWorld } from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";

import { revalidateRoute } from "@/app/(main)/dashboard/revalidate-homepage";
import { Button } from "@/components/ui/button";
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
import { POSTHOG_EVENTS, trackEvent } from "@/lib/analytics/events";
import { api } from "@/trpc/react";

export function AddCustomDomainModal() {
  const { data: userSubscription } = api.subscriptions.get.useQuery();
  const { data: workspace } = api.team.currentWorkspace.useQuery();

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
      error: (err) => err?.message ?? "Failed to add domain",
    });
  };

  const isProUser = userSubscription?.subscriptions?.status === "active";

  const canAddDomains =
    workspace?.type === "personal" ||
    (workspace?.type === "team" &&
      (workspace.role === "owner" || workspace.role === "admin"));

  if (workspace?.type === "team" && !canAddDomains) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-blue-700"
        >
          <IconPlus size={16} stroke={2} />
          {isProUser ? "Add Domain" : "Upgrade to Add Domain"}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Add Domain</DialogTitle>
          <DialogDescription>
            Add a custom domain for your short links
          </DialogDescription>
        </DialogHeader>

        {isProUser ? (
          <DialogBody className="space-y-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="domain"
                className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300"
              >
                Domain
              </Label>
              <div className="relative">
                <IconWorld
                  size={16}
                  stroke={1.5}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500"
                />
                <Input
                  id="domain"
                  className="h-9 border-neutral-200 dark:border-border bg-white dark:bg-card pl-9 text-[13px] placeholder:text-neutral-400"
                  placeholder="links.example.com"
                  value={domain}
                  onChange={handleDomainChange}
                />
              </div>
            </div>
            <div className="flex items-start gap-2.5 rounded-lg border border-neutral-200 dark:border-border bg-neutral-50 dark:bg-accent/50 px-3 py-2.5">
              <IconInfoCircle
                size={14}
                stroke={1.5}
                className="mt-0.5 shrink-0 text-neutral-400 dark:text-neutral-500"
              />
              <p className="text-[12px] text-neutral-500 dark:text-neutral-400">
                Use a subdomain like{" "}
                <span className="font-medium text-neutral-700 dark:text-neutral-300">
                  links.example.com
                </span>{" "}
                if your main domain already has content.
              </p>
            </div>
          </DialogBody>
        ) : (
          <DialogBody>
            <div className="rounded-lg border border-neutral-200 dark:border-border bg-neutral-50 dark:bg-accent/50 px-4 py-3 text-center">
              <p className="text-[13px] text-neutral-500 dark:text-neutral-400">
                Custom domains are available on the Pro plan.
              </p>
            </div>
          </DialogBody>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setIsOpen(false)}
            className="h-9 text-[13px]"
          >
            Cancel
          </Button>
          {isProUser ? (
            <Button
              type="submit"
              onClick={handleCreateDomain}
              disabled={!domain || createCustomDomainMutation.isLoading}
              className="h-9 bg-blue-600 text-[13px] hover:bg-blue-700"
            >
              {createCustomDomainMutation.isLoading
                ? "Adding..."
                : "Add Domain"}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleUpgrade}
              className="h-9 bg-blue-600 text-[13px] hover:bg-blue-700"
            >
              Upgrade to Pro
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
