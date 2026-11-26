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
import { UpgradeCta } from "@/components/upgrade-cta";
import { POSTHOG_EVENTS, trackEvent } from "@/lib/analytics/events";
import { useRecordPlanLimitView } from "@/lib/hooks/use-record-plan-limit-view";
import { createCustomDomainSchema } from "@/server/api/routers/domains/domains.input";
import { api } from "@/trpc/react";

export function AddCustomDomainModal() {
  const { data: userSubscription } = api.subscriptions.get.useQuery();
  const { data: workspace } = api.team.currentWorkspace.useQuery();

  const [domain, setDomain] = useState("");
  const [domainError, setDomainError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const createCustomDomainMutation = api.customDomain.create.useMutation({
    onSuccess: async (data, variables) => {
      toast.success(
        data.inReview
          ? "Domain added. We're reviewing it, and it usually goes live within 24 hours."
          : "Domain added successfully",
      );
      trackEvent(POSTHOG_EVENTS.CUSTOM_DOMAIN_ADDED, {
        domain: variables.domain,
      });
      setDomain("");
      setIsOpen(false);
      await revalidateRoute("/dashboard/domains");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleDomainChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDomain(e.target.value);
    setDomainError(null);
  };

  const handleCreateDomain = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!domain || createCustomDomainMutation.isLoading) {
      return;
    }

    // Same schema the server applies, so typos are caught before the request
    const parsed = createCustomDomainSchema.safeParse({ domain });
    if (!parsed.success) {
      setDomainError(parsed.error.issues[0]?.message ?? "Enter a valid domain");
      return;
    }

    createCustomDomainMutation.mutate(parsed.data);
  };

  const isProUser = (userSubscription?.plan ?? "free") !== "free";
  useRecordPlanLimitView(
    "domains_page_view",
    userSubscription !== undefined && !isProUser && workspace?.type === "personal",
  );

  // Only team owners hold domains.create
  if (workspace?.type === "team" && workspace.role !== "owner") {
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
        <form onSubmit={handleCreateDomain} noValidate className="contents">
          <DialogHeader>
            <DialogTitle>Add Domain</DialogTitle>
            <DialogDescription>Add a custom domain for your short links</DialogDescription>
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
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-muted-foreground"
                  />
                  <Input
                    id="domain"
                    className="h-9 border-neutral-200 dark:border-border bg-white dark:bg-card pl-9 text-[13px] placeholder:text-neutral-400"
                    placeholder="links.example.com"
                    value={domain}
                    onChange={handleDomainChange}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    aria-invalid={domainError !== null}
                    aria-describedby={domainError ? "domain-error" : undefined}
                  />
                </div>
                {domainError && (
                  <p id="domain-error" className="text-[12px] text-red-500">
                    {domainError}
                  </p>
                )}
              </div>
              <div className="flex items-start gap-2.5 rounded-lg border border-neutral-200 dark:border-border bg-neutral-50 dark:bg-accent/50 px-3 py-2.5">
                <IconInfoCircle
                  size={14}
                  stroke={1.5}
                  className="mt-0.5 shrink-0 text-neutral-400 dark:text-muted-foreground"
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
                disabled={!domain || createCustomDomainMutation.isLoading}
                className="h-9 bg-blue-600 text-[13px] hover:bg-blue-700"
              >
                {createCustomDomainMutation.isLoading ? "Adding..." : "Add Domain"}
              </Button>
            ) : (
              // The pricing page owns the billing interval choice (annual by default), so the
              // upgrade goes through it instead of starting a checkout from here.
              <Button asChild className="h-9 bg-blue-600 text-[13px] hover:bg-blue-700">
                <UpgradeCta requiredPlan="pro" source="custom_domain">
                  Upgrade to Pro
                </UpgradeCta>
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
