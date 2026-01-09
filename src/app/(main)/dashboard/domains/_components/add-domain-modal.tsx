"use client";

import { Globe, Lightbulb, Plus } from "lucide-react";
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

  // In team workspaces, only owners and admins can add domains
  const canAddDomains =
    workspace?.type === "personal" ||
    (workspace?.type === "team" &&
      (workspace.role === "owner" || workspace.role === "admin"));

  // Don't render anything if user lacks permission in a team workspace
  if (workspace?.type === "team" && !canAddDomains) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          {isProUser ? "Add Domain" : "Upgrade to Add Domain"}
        </Button>
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
            <div className="space-y-2">
              <Label
                htmlFor="domain"
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Domain
              </Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="domain"
                  className="h-10 pl-10"
                  placeholder="links.example.com"
                  value={domain}
                  onChange={handleDomainChange}
                />
              </div>
            </div>
            <div className="flex items-start gap-2.5 rounded-lg bg-muted/50 border border-border px-3 py-2.5">
              <Lightbulb className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground">
                Use a subdomain like{" "}
                <span className="font-medium text-foreground">
                  links.example.com
                </span>{" "}
                if your main domain already has content.
              </p>
            </div>
          </DialogBody>
        ) : (
          <DialogBody>
            <div className="rounded-lg bg-muted/50 border border-border px-4 py-3 text-center">
              <p className="text-sm text-muted-foreground">
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
            className="h-9"
          >
            Cancel
          </Button>
          {isProUser ? (
            <Button
              type="submit"
              onClick={handleCreateDomain}
              disabled={!domain || createCustomDomainMutation.isLoading}
              className="h-9"
            >
              {createCustomDomainMutation.isLoading ? "Adding..." : "Add Domain"}
            </Button>
          ) : (
            <Button type="button" onClick={handleUpgrade} className="h-9">
              Upgrade to Pro
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
