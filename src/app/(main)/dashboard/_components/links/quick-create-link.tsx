"use client";

import { IconLink } from "@tabler/icons-react";
import { Link as TransitionLink } from "next-view-transitions";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { POSTHOG_EVENTS, trackEvent } from "@/lib/analytics/events";
import { notifyPlanLimit } from "@/lib/analytics/upgrade-prompt";
import { isPlanLimitError, requiredPlanForLimit } from "@/lib/billing/required-plan";
import { INVALID_URL_MESSAGE, normalizeDestinationUrl } from "@/lib/utils/destination-url";
import { api } from "@/trpc/react";

import { useUpgradeOffer } from "../upgrade-offer";

import type { CreatedLink } from "./link-ready-dialog";

type QuickCreateLinkProps = {
  /** Receives the new link; the parent shows it, since this panel unmounts once the list refreshes. */
  onCreated: (link: CreatedLink) => void;
};

/** One-field first-link form for an empty workspace (`link.quickShorten`). */
export function QuickCreateLink({ onCreated }: QuickCreateLinkProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Shares the cache entry the dashboard banner fills, so this adds no request.
  const { data: notice } = api.subscriptions.entitlementNotice.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  const readOnly = notice?.type === "team" && notice.readOnly;

  // Autofocus only where there's a hardware keyboard; on phones it would open
  // the keyboard over the explanation before the user has read it.
  useEffect(() => {
    if (window.matchMedia("(min-width: 768px)").matches) inputRef.current?.focus();
  }, []);

  const upgradeOffer = useUpgradeOffer();
  const quickShorten = api.link.quickShorten.useMutation({
    onSuccess: (data) => {
      setUrl("");
      trackEvent(POSTHOG_EVENTS.LINK_QUICK_SHORTENED, { domain: data.domain, source: "dashboard" });
      onCreated({ alias: data.alias, domain: data.domain });
      router.refresh();
    },
    onError: (mutationError) => {
      setError(mutationError.message);
      if (isPlanLimitError(mutationError)) {
        notifyPlanLimit(
          mutationError.message,
          "link_quick_create",
          requiredPlanForLimit(mutationError.message),
          upgradeOffer,
        );
      }
    },
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = normalizeDestinationUrl(url);
    if (!normalized) {
      setError(INVALID_URL_MESSAGE);
      inputRef.current?.focus();
      return;
    }
    setError(null);
    quickShorten.mutate({ url: normalized });
  };

  return (
    <div className="flex flex-col items-center py-12 text-center sm:py-20">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-neutral-100 dark:bg-muted">
        <IconLink size={24} stroke={1.5} className="text-neutral-400 dark:text-neutral-500" />
      </div>
      <p className="mt-6 text-[14px] font-medium text-neutral-900 dark:text-foreground">
        No links yet
      </p>
      <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-neutral-400 dark:text-neutral-500">
        {readOnly
          ? "Links created in this workspace will show up here."
          : "Shorten a long URL to get a link you can share and track."}
      </p>
      {!readOnly && (
        <>
          <form
            onSubmit={handleSubmit}
            noValidate
            className="mt-6 flex w-full max-w-md flex-col gap-2 sm:flex-row sm:items-start"
          >
            <div className="min-w-0 flex-1 text-left">
              <Input
                ref={inputRef}
                type="url"
                inputMode="url"
                autoComplete="url"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="Paste a long link"
                aria-label="Long link to shorten"
                aria-invalid={error !== null}
                aria-describedby={error ? "quick-create-error" : undefined}
                value={url}
                onChange={(event) => {
                  setUrl(event.target.value);
                  if (error) setError(null);
                }}
                className="h-9 border-neutral-200 bg-white text-[13px] placeholder:text-neutral-400 dark:border-border dark:bg-card"
              />
              {error && (
                <p
                  id="quick-create-error"
                  role="alert"
                  className="mt-1.5 break-words text-[12px] text-red-500"
                >
                  {error}
                </p>
              )}
            </div>
            <Button
              type="submit"
              disabled={quickShorten.isLoading}
              className="h-9 bg-blue-600 text-[13px] text-white hover:bg-blue-700"
            >
              {quickShorten.isLoading ? "Shortening..." : "Shorten"}
            </Button>
          </form>
          <TransitionLink
            href="/dashboard/link/new"
            className="mt-4 rounded-md text-[12px] text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-foreground"
          >
            More options (custom alias, tags, expiry…)
          </TransitionLink>
        </>
      )}
    </div>
  );
}
