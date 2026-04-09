"use client";

import {
  IconBug,
  IconCheck,
  IconExternalLink,
  IconMail,
  IconMessage,
  IconSparkles,
  IconX,
} from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";

type StatusFilter = "open" | "resolved" | "dismissed" | undefined;

const statusTabs: { label: string; value: StatusFilter }[] = [
  { label: "All", value: undefined },
  { label: "Open", value: "open" },
  { label: "Resolved", value: "resolved" },
  { label: "Dismissed", value: "dismissed" },
];

const typeConfig = {
  bug: {
    icon: IconBug,
    label: "Bug Report",
    className: "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400",
  },
  feature: {
    icon: IconSparkles,
    label: "Feature Request",
    className: "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400",
  },
  question: {
    icon: IconMessage,
    label: "Question",
    className: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
};

export default function AdminFeedbackPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [cursor, setCursor] = useState<number | undefined>(undefined);

  const { data, refetch, isLoading } = api.feedback.list.useQuery({
    status: statusFilter,
    cursor,
    limit: 20,
  });

  const updateStatusMutation = api.feedback.updateStatus.useMutation({
    onSuccess: (_, variables) => {
      toast.success(
        variables.status === "resolved"
          ? "Marked as resolved"
          : variables.status === "dismissed"
            ? "Feedback dismissed"
            : "Reopened",
      );
      void refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-foreground">
          Feedback
        </h1>
        <p className="mt-1 text-[13px] text-neutral-400 dark:text-neutral-500">
          User feedback, bug reports, and feature requests
        </p>
      </div>

      {/* Filter tabs */}
      <div className="mb-6 inline-flex gap-1 rounded-lg bg-neutral-100 dark:bg-muted p-1">
        {statusTabs.map((tab) => (
          <button
            key={tab.label}
            onClick={() => {
              setStatusFilter(tab.value);
              setCursor(undefined);
            }}
            className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
              statusFilter === tab.value
                ? "bg-white dark:bg-card text-neutral-900 dark:text-foreground shadow-sm"
                : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-lg bg-neutral-100 dark:bg-muted"
            />
          ))}
        </div>
      )}

      {!isLoading && data && data.items.length === 0 && (
        <div className="rounded-lg border border-dashed border-neutral-300 dark:border-border bg-neutral-50/50 dark:bg-accent/50 px-4 py-12 text-center">
          <IconMessage
            size={32}
            stroke={1.5}
            className="mx-auto mb-3 text-neutral-300 dark:text-neutral-600"
          />
          <p className="text-[13px] font-medium text-neutral-500 dark:text-neutral-400">
            {statusFilter === "open"
              ? "No open feedback"
              : "No feedback found"}
          </p>
          {statusFilter === "open" && (
            <p className="mt-1 text-[12px] text-neutral-400 dark:text-neutral-500">
              All feedback has been addressed
            </p>
          )}
        </div>
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="space-y-2">
            {data.items.map((item) => {
              const config = typeConfig[item.type];
              const TypeIcon = config.icon;

              return (
                <div
                  key={item.id}
                  className="rounded-lg border border-neutral-200 dark:border-border bg-white dark:bg-card p-4 transition-colors hover:border-neutral-300 dark:hover:border-border"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${config.className}`}
                        >
                          <TypeIcon size={12} stroke={1.5} />
                          {config.label}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            item.status === "open"
                              ? "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400"
                              : item.status === "resolved"
                                ? "bg-neutral-100 dark:bg-muted text-neutral-500 dark:text-neutral-400"
                                : "bg-neutral-100 dark:bg-muted text-neutral-400 dark:text-neutral-500"
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>

                      <p className="mt-2 text-[13px] leading-relaxed text-neutral-700 dark:text-neutral-300">
                        {item.message}
                      </p>

                      {/* Image thumbnails */}
                      {item.imageUrls && item.imageUrls.length > 0 && (
                        <div className="mt-3 flex gap-2">
                          {item.imageUrls.map((url, i) => (
                            <a
                              key={i}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-neutral-200 dark:border-border transition-colors hover:border-neutral-300 dark:hover:border-border"
                            >
                              <img
                                src={url}
                                alt={`Attachment ${i + 1}`}
                                className="h-full w-full object-cover"
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
                                <IconExternalLink
                                  size={12}
                                  className="text-white opacity-0 transition-opacity group-hover:opacity-100"
                                />
                              </div>
                            </a>
                          ))}
                        </div>
                      )}

                      <div className="mt-2 flex items-center gap-2 text-[11px] text-neutral-400 dark:text-neutral-500">
                        <span>
                          {item.user?.name && item.user?.email
                            ? `${item.user.name} (${item.user.email})`
                            : item.user?.email ?? item.user?.name ?? "Unknown user"}
                        </span>
                        <span>·</span>
                        <span>
                          {item.createdAt
                            ? new Date(item.createdAt).toLocaleDateString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                },
                              )
                            : "N/A"}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      {item.user?.email && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-[12px]"
                          asChild
                        >
                          <a
                            href={`mailto:${item.user.email}?subject=${encodeURIComponent(`Re: Your ${config.label.toLowerCase()} on iShortn`)}&body=${encodeURIComponent(`Hi ${item.user.name ?? "there"},\n\nRegarding your feedback:\n"${item.message.slice(0, 200)}${item.message.length > 200 ? "..." : ""}"\n\n`)}`}
                          >
                            <IconMail size={14} />
                            Reply
                          </a>
                        </Button>
                      )}
                      {item.status === "open" && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-[12px]"
                            onClick={() =>
                              updateStatusMutation.mutate({
                                id: item.id,
                                status: "resolved",
                              })
                            }
                            disabled={updateStatusMutation.isLoading}
                          >
                            <IconCheck size={14} />
                            Resolve
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-[12px] text-neutral-400"
                            onClick={() =>
                              updateStatusMutation.mutate({
                                id: item.id,
                                status: "dismissed",
                              })
                            }
                            disabled={updateStatusMutation.isLoading}
                          >
                            <IconX size={14} />
                            Dismiss
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {(data.nextCursor || cursor) && (
            <div className="mt-4 flex items-center justify-end gap-2">
              {cursor && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCursor(undefined)}
                  className="h-8 text-[12px]"
                >
                  Back to first
                </Button>
              )}
              {data.nextCursor && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCursor(data.nextCursor)}
                  className="h-8 text-[12px]"
                >
                  Load more
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
