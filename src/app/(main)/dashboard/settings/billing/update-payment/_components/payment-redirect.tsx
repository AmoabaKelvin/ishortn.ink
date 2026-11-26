"use client";

import { IconAlertCircle, IconLoader2 } from "@tabler/icons-react";
import { Link } from "next-view-transitions";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

import { openPaymentPage } from "./open-payment-page";

import type { PaymentUpdateSource } from "@/lib/billing/entitlements";

export function RedirectingState() {
  return (
    <div
      aria-live="polite"
      className="flex min-h-[400px] flex-col items-center justify-center py-20 text-center"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-neutral-100 dark:bg-muted">
        <IconLoader2
          size={24}
          stroke={1.5}
          className="animate-spin text-neutral-400 dark:text-muted-foreground"
        />
      </div>
      <p className="mt-6 text-[14px] font-medium text-neutral-900 dark:text-foreground">
        Opening the payment page
      </p>
      <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-neutral-500 dark:text-neutral-400">
        You&apos;ll update your card on Lemon Squeezy, our payment provider.
      </p>
    </div>
  );
}

/** Sends the customer to the subscription's update-payment-method page. */
export function PaymentRedirect({
  url,
  source,
}: {
  url: string | null;
  source: PaymentUpdateSource | null;
}) {
  useEffect(() => {
    // replace: Back from Lemon Squeezy returns to the page that linked here.
    void openPaymentPage({ url, source, navigate: (target) => window.location.replace(target) });
  }, [url, source]);

  if (url) return <RedirectingState />;

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-red-50 dark:bg-red-500/10">
        <IconAlertCircle size={24} stroke={1.5} className="text-red-600 dark:text-red-400" />
      </div>
      <p className="mt-6 text-[14px] font-medium text-neutral-900 dark:text-foreground">
        Couldn&apos;t open the payment page
      </p>
      <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-neutral-500 dark:text-neutral-400">
        No subscription was found for this account, or the payment provider didn&apos;t respond.
        Manage your subscription from billing settings.
      </p>
      <Button
        asChild
        className="mt-6 rounded-lg bg-blue-600 text-[13px] text-white hover:bg-blue-700"
      >
        <Link href="/dashboard/settings#billing">Billing settings</Link>
      </Button>
    </div>
  );
}
