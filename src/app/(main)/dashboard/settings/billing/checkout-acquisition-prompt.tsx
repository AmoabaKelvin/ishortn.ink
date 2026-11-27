"use client";

import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { POSTHOG_EVENTS, trackEvent } from "@/lib/analytics/events";
import { api } from "@/trpc/react";

import {
  AcquisitionForm,
  useDismissAcquisition,
} from "../../_components/acquisition-prompt/acquisition-form";

import type { Plan } from "@/lib/billing/plans";

// The checkout redirect can land before the subscription webhook; poll briefly for the paid plan.
const PLAN_POLL_INTERVAL_MS = 3000;
const PLAN_POLL_ATTEMPTS = 10;
/** How long the poll waits for the subscription webhook before giving up. */
export const CHECKOUT_CONFIRM_TIMEOUT_MS = PLAN_POLL_INTERVAL_MS * PLAN_POLL_ATTEMPTS;

/**
 * Asks a new subscriber how they found iShortn, once, on return from checkout. `onPaidPlan` runs
 * once the poll sees the paid plan, so the billing card can reload what it rendered before.
 */
export function CheckoutAcquisitionPrompt({ onPaidPlan }: { onPaidPlan: () => void }) {
  const [open, setOpen] = useState(false);
  const [shownPlan, setShownPlan] = useState<Plan | null>(null);
  // Set once a paid plan is seen: the prompt is decided and the query stops.
  const [settled, setSettled] = useState(false);

  // Drop the flag so a reload or a shared URL doesn't ask again.
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("checkout");
    window.history.replaceState(window.history.state, "", url);
  }, []);

  api.audienceFeedback.acquisitionPrompt.useQuery(undefined, {
    enabled: !settled,
    refetchOnWindowFocus: false,
    refetchInterval: (state, query) =>
      state?.plan === "free" && query.state.dataUpdateCount < PLAN_POLL_ATTEMPTS
        ? PLAN_POLL_INTERVAL_MS
        : false,
    onSuccess: (prompt) => {
      if (settled) return;
      if (prompt.plan === "free") return;
      setSettled(true);
      onPaidPlan();
      if (!prompt.showAfterCheckout) return;
      setShownPlan(prompt.plan);
      setOpen(true);
      trackEvent(POSTHOG_EVENTS.ACQUISITION_PROMPT_SHOWN, {
        source: "checkout",
        plan: prompt.plan,
      });
    },
  });

  if (shownPlan === null) return null;

  return <AcquisitionDialog plan={shownPlan} open={open} onClose={() => setOpen(false)} />;
}

function AcquisitionDialog({
  plan,
  open,
  onClose,
}: {
  plan: Plan;
  open: boolean;
  onClose: () => void;
}) {
  const dismiss = useDismissAcquisition("checkout", plan);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        // Escape, the overlay and the close button count as "Not now".
        if (nextOpen) return;
        dismiss();
        onClose();
      }}
    >
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>How did you find iShortn?</DialogTitle>
          <DialogDescription>
            Thanks for subscribing. Two quick questions that help us reach more people like you.
          </DialogDescription>
        </DialogHeader>
        <AcquisitionForm source="checkout" plan={plan} variant="dialog" onDone={onClose} />
      </DialogContent>
    </Dialog>
  );
}
