"use client";

import { IconAlertCircle, IconLoader2 } from "@tabler/icons-react";
import { Link } from "next-view-transitions";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { clientLogger } from "@/lib/logger/client";

import { openPaddleCheckout } from "./open-paddle-checkout";

import type { Environments } from "@paddle/paddle-js";

export function LoadingCheckoutState() {
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
        Loading secure checkout…
      </p>
      <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-neutral-500 dark:text-neutral-400">
        Payment is handled by Paddle, our payment provider.
      </p>
    </div>
  );
}

/** Opens the Paddle overlay checkout for a server-created transaction. */
export function PaddleCheckout({
  environment,
  clientToken,
  transactionId,
  successUrl,
}: {
  environment: Environments;
  clientToken: string;
  transactionId: string;
  successUrl: string;
}) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    void openPaddleCheckout({
      environment,
      token: clientToken,
      transactionId,
      successUrl,
      onAbandoned: () => router.replace("/dashboard/pricing"),
    }).then((opened) => {
      if (opened || !active) return;
      clientLogger.error({ transactionId }, "paddle.js failed to load");
      setFailed(true);
    });
    return () => {
      active = false;
    };
  }, [environment, clientToken, transactionId, successUrl, router]);

  if (!failed) return <LoadingCheckoutState />;

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-red-50 dark:bg-red-500/10">
        <IconAlertCircle size={24} stroke={1.5} className="text-red-600 dark:text-red-400" />
      </div>
      <p className="mt-6 text-[14px] font-medium text-neutral-900 dark:text-foreground">
        Couldn&apos;t load checkout
      </p>
      <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-neutral-500 dark:text-neutral-400">
        The payment form didn&apos;t load. A browser extension or network filter may be blocking it.
        You haven&apos;t been charged.
      </p>
      <Button
        asChild
        className="mt-6 rounded-lg bg-blue-600 text-[13px] text-white hover:bg-blue-700"
      >
        <Link href="/dashboard/pricing">Back to pricing</Link>
      </Button>
    </div>
  );
}
