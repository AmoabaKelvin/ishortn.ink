"use client";

import { IconAlertCircle, IconInbox } from "@tabler/icons-react";
import { formatDistanceToNow } from "date-fns";

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

import type { RouterOutputs } from "@/trpc/shared";

type Delivery = RouterOutputs["webhook"]["deliveries"][number];

function DeliveryStatus({ delivery }: { delivery: Delivery }) {
  const tone =
    delivery.status === "succeeded"
      ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
      : delivery.status === "failed"
        ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
        : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400";
  const label =
    delivery.responseStatus ??
    (delivery.status === "pending" && delivery.attempts === 0 ? "Queued" : "No response");
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
        tone,
      )}
    >
      {label}
    </span>
  );
}

function DeliveryRow({ delivery }: { delivery: Delivery }) {
  const retries = Math.max(delivery.attempts - 1, 0);
  const at = delivery.lastAttemptAt ?? delivery.createdAt;
  return (
    <tr className="align-top">
      <td className="px-3 py-3 sm:px-4">
        <code className="font-mono text-[12px] text-neutral-900 dark:text-foreground">
          {delivery.eventType}
        </code>
        {delivery.error && (
          <p className="mt-0.5 break-all text-[12px] text-neutral-400 dark:text-muted-foreground">
            {delivery.error}
          </p>
        )}
        {delivery.status === "pending" && delivery.nextAttemptAt && (
          <p className="mt-0.5 text-[12px] text-amber-700 dark:text-amber-400">
            Next try {formatDistanceToNow(delivery.nextAttemptAt, { addSuffix: true })}
          </p>
        )}
      </td>
      <td className="px-3 py-3 sm:px-4">
        <DeliveryStatus delivery={delivery} />
      </td>
      <td className="hidden px-4 py-3 text-right text-[12px] tabular-nums text-neutral-500 dark:text-neutral-400 sm:table-cell">
        {delivery.durationMs !== null ? `${delivery.durationMs.toLocaleString()} ms` : "—"}
      </td>
      <td className="hidden px-4 py-3 text-right text-[12px] tabular-nums text-neutral-500 dark:text-neutral-400 sm:table-cell">
        {retries.toLocaleString()}
      </td>
      <td
        className="px-3 py-3 text-right sm:whitespace-nowrap sm:px-4 text-[12px] text-neutral-500 dark:text-neutral-400"
        title={at.toLocaleString()}
      >
        {formatDistanceToNow(at, { addSuffix: true })}
        <span className="block text-neutral-400 dark:text-muted-foreground sm:hidden">
          {retries.toLocaleString()} {retries === 1 ? "retry" : "retries"}
        </span>
      </td>
    </tr>
  );
}

/** The endpoint's last 50 deliveries, loaded when the dialog opens. */
export function WebhookDeliveriesDialog({
  webhookId,
  url,
  open,
  onOpenChange,
}: {
  webhookId: number;
  url: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const deliveries = api.webhook.deliveries.useQuery(
    { id: webhookId },
    { enabled: open, refetchOnWindowFocus: false },
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid-cols-1 sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Deliveries</DialogTitle>
          <DialogDescription className="break-all">Last 50 events sent to {url}</DialogDescription>
        </DialogHeader>

        <DialogBody>
          {deliveries.isLoading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-11 w-full rounded-lg" />
              ))}
            </div>
          ) : deliveries.isError ? (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600 dark:border-red-800 dark:bg-red-500/10 dark:text-red-400">
              <IconAlertCircle size={16} stroke={1.5} className="mt-0.5 shrink-0" />
              <p className="min-w-0">
                {deliveries.error.message}{" "}
                <button
                  type="button"
                  onClick={() => void deliveries.refetch()}
                  className="font-medium underline underline-offset-2"
                >
                  Try again
                </button>
              </p>
            </div>
          ) : deliveries.data.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-200 px-4 py-10 text-center dark:border-border">
              <IconInbox
                size={18}
                stroke={1.5}
                className="mx-auto text-neutral-400 dark:text-muted-foreground"
              />
              <p className="mt-2 text-[13px] font-medium text-neutral-900 dark:text-foreground">
                No deliveries yet
              </p>
              <p className="mx-auto mt-1 max-w-xs text-[12px] text-neutral-400 dark:text-muted-foreground">
                Events show up here once they&apos;re sent. Use Send test event to try the endpoint.
              </p>
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-neutral-200 dark:border-border">
              <table className="w-full text-left">
                <thead className="bg-neutral-50 text-[11px] font-medium text-neutral-500 dark:bg-accent/50 dark:text-neutral-400">
                  <tr>
                    <th scope="col" className="px-3 py-2.5 font-medium sm:px-4">
                      Event
                    </th>
                    <th scope="col" className="px-3 py-2.5 font-medium sm:px-4">
                      Status
                    </th>
                    <th
                      scope="col"
                      className="hidden px-4 py-2.5 text-right font-medium sm:table-cell"
                    >
                      Duration
                    </th>
                    <th
                      scope="col"
                      className="hidden px-4 py-2.5 text-right font-medium sm:table-cell"
                    >
                      Retries
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium sm:px-4">
                      Time
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-300/60 dark:divide-border">
                  {deliveries.data.map((delivery) => (
                    <DeliveryRow key={delivery.id} delivery={delivery} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
