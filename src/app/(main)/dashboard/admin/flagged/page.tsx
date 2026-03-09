"use client";

import {
  IconBan,
  IconCheck,
  IconFlag,
  IconShieldCheck,
} from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";

type StatusFilter = "pending" | "blocked" | "dismissed" | undefined;

const statusTabs: { label: string; value: StatusFilter }[] = [
  { label: "All", value: undefined },
  { label: "Pending", value: "pending" },
  { label: "Blocked", value: "blocked" },
  { label: "Dismissed", value: "dismissed" },
];

export default function AdminFlaggedLinksPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [page, setPage] = useState(1);

  const { data, refetch, isLoading } = api.admin.getFlaggedLinks.useQuery({
    status: statusFilter,
    page,
    pageSize: 20,
  });

  const resolveMutation = api.admin.resolveFlaggedLink.useMutation({
    onSuccess: (_, variables) => {
      toast.success(
        variables.action === "blocked"
          ? "Link blocked successfully"
          : "Flag dismissed",
      );
      void refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
          Flagged Links
        </h1>
        <p className="mt-1 text-[13px] text-neutral-400">
          Review and resolve flagged content
        </p>
      </div>

      {/* Filter tabs */}
      <div className="mb-6 inline-flex gap-1 rounded-lg bg-neutral-100 p-1">
        {statusTabs.map((tab) => (
          <button
            key={tab.label}
            onClick={() => {
              setStatusFilter(tab.value);
              setPage(1);
            }}
            className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
              statusFilter === tab.value
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-500 hover:text-neutral-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-neutral-100" />
          ))}
        </div>
      )}

      {data && data.flaggedLinks.length === 0 && (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50/50 px-4 py-12 text-center">
          {statusFilter === "pending" ? (
            <>
              <IconShieldCheck size={32} stroke={1.5} className="mx-auto mb-3 text-green-400" />
              <p className="text-[13px] font-medium text-neutral-500">
                No pending flags
              </p>
              <p className="mt-1 text-[12px] text-neutral-400">
                All flagged links have been reviewed
              </p>
            </>
          ) : (
            <>
              <IconFlag size={32} stroke={1.5} className="mx-auto mb-3 text-neutral-300" />
              <p className="text-[13px] font-medium text-neutral-500">
                No flagged links found
              </p>
            </>
          )}
        </div>
      )}

      {data && data.flaggedLinks.length > 0 && (
        <>
          <p className="mb-3 text-[12px] text-neutral-400">
            {data.total} {data.total === 1 ? "result" : "results"}
          </p>

          <div className="space-y-2">
            {data.flaggedLinks.map((f) => (
              <div
                key={f.id}
                className="rounded-lg border border-neutral-200 bg-white p-4 transition-colors hover:border-neutral-300"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-medium text-neutral-800">
                        {f.linkDomain && f.linkAlias
                          ? `${f.linkDomain}/${f.linkAlias}`
                          : "Unknown link"}
                      </p>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          f.status === "pending"
                            ? "bg-amber-50 text-amber-700"
                            : f.status === "blocked"
                              ? "bg-red-50 text-red-700"
                              : "bg-neutral-100 text-neutral-500"
                        }`}
                      >
                        {f.status}
                      </span>
                    </div>
                    <p className="mt-0.5 max-w-[500px] truncate text-[12px] text-neutral-400">
                      {f.linkUrl ?? "N/A"}
                    </p>
                    {f.reason && (
                      <p className="mt-2 text-[12px] text-neutral-500">
                        <span className="font-medium text-neutral-600">Reason:</span>{" "}
                        {f.reason}
                      </p>
                    )}
                    <p className="mt-1 text-[11px] text-neutral-400">
                      Flagged{" "}
                      {f.flaggedAt
                        ? new Date(f.flaggedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "N/A"}
                    </p>
                  </div>
                  {f.status === "pending" && (
                    <div className="flex shrink-0 gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-8 text-[12px]"
                        onClick={() =>
                          resolveMutation.mutate({
                            id: f.id,
                            action: "blocked",
                          })
                        }
                        disabled={resolveMutation.isLoading}
                      >
                        <IconBan size={14} />
                        Block
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-[12px]"
                        onClick={() =>
                          resolveMutation.mutate({
                            id: f.id,
                            action: "dismissed",
                          })
                        }
                        disabled={resolveMutation.isLoading}
                      >
                        <IconCheck size={14} />
                        Dismiss
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-[12px] text-neutral-400">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="h-8 text-[12px]"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="h-8 text-[12px]"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
