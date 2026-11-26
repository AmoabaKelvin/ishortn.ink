"use client";

import { IconCalendarDollar, IconLoader2, IconX } from "@tabler/icons-react";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { POSTHOG_EVENTS, trackEvent } from "@/lib/analytics/events";
import { PLAN_NAMES } from "@/lib/billing/entitlements";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

import {
  buildPlanChangeCopy,
  PlanChangeConfirmDialog,
} from "../pricing/_components/plan-change-confirm-dialog";
import { annualSwitchDismissKey, isAnnualSwitchDismissed } from "./annual-switch-state";

import type { AnnualSwitchOffer } from "./annual-switch-state";

const DISMISS_EVENT = "ishortn:annual-switch:dismiss";
// Hidden on the server so hydration matches; the card enters once the client has read the
// stored dismissal (same approach as promo-banner.tsx).
const SERVER_SNAPSHOT = "server";
const readServerSnapshot = () => SERVER_SNAPSHOT;

function subscribeDismissed(onChange: () => void) {
  window.addEventListener(DISMISS_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(DISMISS_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function storeDismissal(key: string) {
  try {
    window.localStorage.setItem(key, String(Date.now()));
  } catch {
    // Storage can be unavailable (private mode); the card then just stays.
  }
  window.dispatchEvent(new Event(DISMISS_EVENT));
}

type AnnualSwitchCardProps = {
  offer: AnnualSwitchOffer;
  source: "dashboard" | "billing";
  className?: string;
};

/** Dismissible offer for monthly Pro and Ultra subscribers to move to annual billing. */
export function AnnualSwitchCard({ offer, source, className }: AnnualSwitchCardProps) {
  const pathname = usePathname();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const key = annualSwitchDismissKey(offer.userId);
  const stored = useSyncExternalStore(
    subscribeDismissed,
    () => {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    readServerSnapshot,
  );

  const createCheckoutOrUpdate = api.lemonsqueezy.createCheckoutOrUpdate.useMutation({
    onSuccess: (data) => {
      if (data.status === "redirect") {
        window.location.href = data.url;
        return;
      }
      if (data.status === "updated") {
        trackEvent(POSTHOG_EVENTS.SUBSCRIPTION_UPGRADED, {
          from_plan: offer.plan,
          to_plan: offer.plan,
          interval: "annual",
          source: "annual_switch_card",
        });
        // The reload reads the annual variant already; this also covers a slow local sync.
        storeDismissal(key);
        toast.success(data.message);
        window.location.reload();
        return;
      }
      setConfirmOpen(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const dismissed =
    stored === SERVER_SNAPSHOT || isAnnualSwitchDismissed(stored === null ? null : Number(stored));
  // The layout copy is for the dashboard home only; Settings renders its own above Billing.
  const visible = !dismissed && (source !== "dashboard" || pathname === "/dashboard");

  useEffect(() => {
    if (visible) {
      trackEvent(POSTHOG_EVENTS.ANNUAL_SWITCH_CARD_SHOWN, { plan: offer.plan, source });
    }
  }, [visible, offer.plan, source]);

  if (!visible) return null;

  const planName = PLAN_NAMES[offer.plan];
  const confirmCopy = buildPlanChangeCopy("switch", offer.plan, "annual");
  // Stays busy after success until the page reloads.
  const isSwitching = createCheckoutOrUpdate.isLoading || createCheckoutOrUpdate.isSuccess;

  const dismiss = () => {
    trackEvent(POSTHOG_EVENTS.ANNUAL_SWITCH_CARD_DISMISSED, { plan: offer.plan, source });
    storeDismissal(key);
  };

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-3 text-[13px] text-neutral-700 ease-[cubic-bezier(0.23,1,0.32,1)] motion-safe:duration-200 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 sm:items-center sm:py-2 dark:border-border dark:bg-card dark:text-neutral-300",
        className,
      )}
    >
      <IconCalendarDollar
        size={16}
        stroke={1.5}
        aria-hidden="true"
        className="mt-0.5 shrink-0 text-blue-600 sm:mt-0 dark:text-blue-400"
      />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <p className="min-w-0 tabular-nums">
          <span className="font-medium text-neutral-900 dark:text-foreground">
            Pay yearly and get 2 months free:
          </span>{" "}
          {`$${offer.annualPrice}/yr instead of $${offer.monthlyYearTotal} for ${planName}, saving $${offer.saving}.`}
        </p>
        <Button
          size="sm"
          variant="outline"
          className="h-8 shrink-0 text-[12px]"
          onClick={() => {
            trackEvent(POSTHOG_EVENTS.ANNUAL_SWITCH_CARD_CLICKED, { plan: offer.plan, source });
            setConfirmOpen(true);
          }}
          disabled={isSwitching}
        >
          {isSwitching && <IconLoader2 size={14} stroke={1.5} className="mr-1.5 animate-spin" />}
          Switch to annual
        </Button>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss the annual billing offer"
        className="-mr-1 shrink-0 rounded-md p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:text-muted-foreground dark:hover:bg-accent dark:hover:text-neutral-300"
      >
        <IconX size={14} stroke={1.5} />
      </button>

      <PlanChangeConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={confirmCopy.title}
        description={confirmCopy.description}
        note={confirmCopy.note}
        confirmLabel={confirmCopy.confirmLabel}
        isLoading={isSwitching}
        onConfirm={() => createCheckoutOrUpdate.mutate({ plan: offer.plan, interval: "annual" })}
      />
    </div>
  );
}
