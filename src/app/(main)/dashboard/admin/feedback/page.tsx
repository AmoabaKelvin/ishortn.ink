"use client";

import {
  IconBug,
  IconCheck,
  IconCornerUpLeft,
  IconExternalLink,
  IconMessage,
  IconSparkles,
  IconX,
} from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { displayName } from "@/lib/utils/user-name";
import { api } from "@/trpc/react";

import { useCursorPages } from "../_components/use-cursor-pages";
import { ReplyFeedbackDialog } from "./_components/reply-feedback-dialog";

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
  const [replyTarget, setReplyTarget] = useState<{
    id: number;
    message: string;
    email: string;
  } | null>(null);
  const pages = useCursorPages();
  const { cursor } = pages;

  const { data, refetch, isLoading } = api.feedback.list.useQuery({
    status: statusFilter,
    cursor,
    limit: 20,
  });

  const refetchPage = async () => {
    const { data: fresh } = await refetch();
    // Resolving every item on a later page empties it; step back instead of stranding there.
    if (fresh?.items.length === 0 && pages.hasPrevious) pages.previous();
  };

  const updateStatusMutation = api.feedback.updateStatus.useMutation({
    onSuccess: async (_, variables) => {
      toast.success(
        variables.status === "resolved"
          ? "Marked as resolved"
          : variables.status === "dismissed"
            ? "Feedback dismissed"
            : "Reopened",
      );
      await refetchPage();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-foreground">
          Feedback
        </h1>
        <p className="mt-1 text-[13px] text-neutral-400 dark:text-muted-foreground">
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
              pages.reset();
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
            <div key={i} className="h-20 animate-pulse rounded-lg bg-neutral-100 dark:bg-muted" />
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
            {statusFilter === "open" ? "No open feedback" : "No feedback found"}
          </p>
          {statusFilter === "open" && (
            <p className="mt-1 text-[12px] text-neutral-400 dark:text-muted-foreground">
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
              const email = item.user?.email;

              return (
                <div
                  key={item.id}
                  className="rounded-lg border border-neutral-200 dark:border-border bg-white dark:bg-card p-4 transition-colors hover:border-neutral-300 dark:hover:border-border"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
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
                                : "bg-neutral-100 dark:bg-muted text-neutral-400 dark:text-muted-foreground"
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>

                      <p className="mt-2 text-[13px] leading-relaxed break-words whitespace-pre-wrap text-neutral-700 dark:text-neutral-300">
                        {item.message}
                      </p>

                      {item.replyMessage && (
                        <div className="mt-3 rounded-lg bg-blue-50 px-3 py-2 dark:bg-blue-500/10">
                          <p className="text-[11px] font-medium text-blue-600 dark:text-blue-400">
                            We replied
                            {item.repliedAt &&
                              ` · ${new Date(item.repliedAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}`}
                          </p>
                          <p className="mt-1 text-[13px] leading-relaxed break-words whitespace-pre-wrap text-neutral-700 dark:text-neutral-300">
                            {item.replyMessage}
                          </p>
                        </div>
                      )}

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
                              {/* eslint-disable-next-line next/no-img-element -- user-uploaded attachment from arbitrary storage host */}
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

                      <div className="mt-2 flex min-w-0 items-center gap-2 text-[11px] text-neutral-400 dark:text-muted-foreground">
                        <span className="min-w-0 truncate">
                          {displayName(item.user?.name) && item.user?.email
                            ? `${displayName(item.user.name)} (${item.user.email})`
                            : (item.user?.email ?? displayName(item.user?.name) ?? "Unknown user")}
                        </span>
                        <span>·</span>
                        <span className="shrink-0">
                          {item.createdAt
                            ? new Date(item.createdAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : "N/A"}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      {email && !item.repliedAt && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-[12px]"
                          onClick={() =>
                            setReplyTarget({ id: item.id, message: item.message, email })
                          }
                        >
                          <IconCornerUpLeft size={14} stroke={1.5} />
                          Reply
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
          {(data.nextCursor || pages.hasPrevious) && (
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={pages.previous}
                disabled={!pages.hasPrevious}
                className="h-8 text-[12px]"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => data.nextCursor && pages.next(data.nextCursor)}
                disabled={!data.nextCursor}
                className="h-8 text-[12px]"
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      <ReplyFeedbackDialog
        feedback={replyTarget}
        onOpenChange={(open) => !open && setReplyTarget(null)}
        onReplied={() => void refetchPage()}
      />
    </div>
  );
}
