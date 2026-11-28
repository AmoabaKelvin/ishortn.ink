"use client";

import { IconAlertTriangle, IconDownload, IconMailPlus, IconTrash } from "@tabler/icons-react";
import { format } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

import type { RouterOutputs } from "@/trpc/shared";

type Subscriber = RouterOutputs["bioPage"]["listSubscribers"]["items"][number];

const PAGE_SIZE = 25;

const pluralize = (n: number) => `${n.toLocaleString()} ${n === 1 ? "subscriber" : "subscribers"}`;

export function SubscribersPanel({
  pageId,
  hasSignupBlock,
}: {
  pageId: number;
  hasSignupBlock: boolean;
}) {
  const [page, setPage] = useState(1);
  const utils = api.useUtils();
  const { data, isLoading, isError, isFetching, isPreviousData, refetch } =
    api.bioPage.listSubscribers.useQuery(
      { bioPageId: pageId, page, pageSize: PAGE_SIZE },
      { keepPreviousData: true, refetchOnWindowFocus: false },
    );

  const exportCsv = api.bioPage.exportSubscribers.useMutation({
    onSuccess: ({ csv, rowCount, truncated, slug }) => {
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${slug}-subscribers.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success(
        truncated
          ? `Exported the newest ${pluralize(rowCount)}.`
          : `Exported ${pluralize(rowCount)}.`,
      );
    },
    onError: (error) => toast.error(error.message),
  });

  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const onDeleted = async () => {
    toast.success("Subscriber removed.");
    // Step back when the last row on a later page goes, so the list isn't empty.
    if (data && data.items.length === 1 && page > 1) setPage(page - 1);
    await utils.bioPage.listSubscribers.invalidate({ bioPageId: pageId });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold text-neutral-900 dark:text-foreground">
            Subscribers
          </h3>
          <p className="text-[12px] tabular-nums text-neutral-500 dark:text-neutral-400">
            {data ? pluralize(total) : "Emails collected by this page's signup forms"}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-9 gap-1.5 self-start border-neutral-200 bg-white px-3 text-[13px] text-neutral-700 sm:self-auto dark:border-border dark:bg-card dark:text-neutral-300"
          disabled={exportCsv.isLoading || total === 0}
          onClick={() => exportCsv.mutate({ id: pageId })}
        >
          <IconDownload
            size={14}
            stroke={1.5}
            className="text-neutral-400 dark:text-muted-foreground"
          />
          {exportCsv.isLoading ? "Exporting..." : "Export CSV"}
        </Button>
      </div>

      {isError && (!data || isPreviousData) ? (
        <div
          role="alert"
          className="flex flex-col items-center rounded-lg border border-dashed border-neutral-200 px-4 py-10 text-center dark:border-border"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
            <IconAlertTriangle size={16} stroke={1.5} />
          </span>
          <p className="mt-3 text-[14px] font-medium text-neutral-900 dark:text-foreground">
            Couldn&apos;t load subscribers
          </p>
          <p className="mt-1 max-w-xs text-[13px] text-neutral-500 dark:text-neutral-400">
            Something went wrong while loading this page&apos;s subscribers.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            {isFetching ? "Retrying…" : "Try again"}
          </Button>
        </div>
      ) : isLoading || !data ? (
        <div className="divide-y divide-neutral-300/60 rounded-lg border border-neutral-200 bg-white dark:divide-border dark:border-border dark:bg-card">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-7 w-7 rounded-md" />
            </div>
          ))}
        </div>
      ) : total === 0 ? (
        <div className="flex flex-col items-center rounded-lg border border-dashed border-neutral-200 px-4 py-12 text-center dark:border-border">
          <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-neutral-100 dark:bg-muted">
            <IconMailPlus
              size={24}
              stroke={1.5}
              className="text-neutral-400 dark:text-muted-foreground"
            />
          </span>
          <p className="mt-4 text-[14px] font-medium text-neutral-900 dark:text-foreground">
            No subscribers yet
          </p>
          <p className="mt-1 max-w-xs text-[13px] text-neutral-500 dark:text-neutral-400">
            {hasSignupBlock
              ? "When visitors sign up through your email signup form, they show up here."
              : "Add an Email signup block on the Content tab to start collecting emails."}
          </p>
        </div>
      ) : (
        <div className={cn("space-y-3 transition-opacity", isFetching && "opacity-60")}>
          <ul className="divide-y divide-neutral-300/60 rounded-lg border border-neutral-200 bg-white dark:divide-border dark:border-border dark:bg-card">
            {data.items.map((subscriber) => (
              <SubscriberRow key={subscriber.id} subscriber={subscriber} onDeleted={onDeleted} />
            ))}
          </ul>

          {pageCount > 1 && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-[12px] tabular-nums text-neutral-500 dark:text-neutral-400">
                {((page - 1) * PAGE_SIZE + 1).toLocaleString()}–
                {Math.min(page * PAGE_SIZE, total).toLocaleString()} of {total.toLocaleString()}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || isFetching}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= pageCount || isFetching}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SubscriberRow({
  subscriber,
  onDeleted,
}: {
  subscriber: Subscriber;
  onDeleted: () => Promise<void>;
}) {
  const remove = api.bioPage.deleteSubscriber.useMutation({
    onSuccess: onDeleted,
    onError: (error) => toast.error(error.message),
  });

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-neutral-900 dark:text-foreground">
          {subscriber.email}
        </p>
        <p className="text-[12px] text-neutral-400 dark:text-muted-foreground">
          Signed up {format(subscriber.createdAt, "MMM d, yyyy 'at' h:mm a")}
        </p>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            type="button"
            disabled={remove.isLoading}
            className="shrink-0 rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:pointer-events-none disabled:opacity-50 dark:hover:bg-red-500/10 dark:hover:text-red-400"
            title="Remove"
            aria-label={`Remove ${subscriber.email}`}
          >
            <IconTrash size={16} stroke={1.5} />
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this subscriber?</AlertDialogTitle>
            <AlertDialogDescription className="break-all">
              {subscriber.email} will be removed from this page&apos;s list and future exports. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={remove.isLoading}
              onClick={() => remove.mutate({ id: subscriber.id })}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
