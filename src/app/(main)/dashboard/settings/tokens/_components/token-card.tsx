"use client";

import { IconKey, IconLoader2, IconTrash } from "@tabler/icons-react";
import { toast } from "sonner";

import { revalidateRoute } from "@/app/(main)/dashboard/revalidate-homepage";
import { POSTHOG_EVENTS, trackEvent } from "@/lib/analytics/events";
import { api } from "@/trpc/react";

const TokenCard = ({
  start,
  createdAt,
  keyID,
}: {
  start: string;
  createdAt: number;
  keyID: number;
}) => {
  const deleteAPIKeyMutation = api.token.delete.useMutation({
    onSuccess: async () => {
      await revalidateRoute("/dashboard/settings");
      trackEvent(POSTHOG_EVENTS.API_KEY_REVOKED);
      toast.success("API Token revoked");
    },
  });

  const handleKeyRevoke = () => {
    deleteAPIKeyMutation.mutate({ id: keyID });
  };

  return (
    <div className="flex items-center gap-4">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-neutral-100 dark:bg-muted">
        <IconKey size={15} stroke={1.5} className="text-neutral-400 dark:text-neutral-500" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <code className="rounded-md bg-neutral-50 dark:bg-accent/50 px-2 py-0.5 font-mono text-[12px] text-neutral-600 dark:text-neutral-400">
            {start}••••••••••••
          </code>
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Active
          </span>
        </div>
        <p className="mt-1 text-[11px] text-neutral-400 dark:text-neutral-500">
          Created{" "}
          {new Date(createdAt).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </p>
      </div>

      <button
        type="button"
        onClick={handleKeyRevoke}
        disabled={deleteAPIKeyMutation.isLoading}
        className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 dark:border-border px-3 py-1.5 text-[12px] font-medium text-red-600 dark:text-red-400 transition-colors hover:border-red-200 dark:hover:border-red-800 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-50"
      >
        {deleteAPIKeyMutation.isLoading ? (
          <IconLoader2 size={13} stroke={1.5} className="animate-spin" />
        ) : (
          <IconTrash size={13} stroke={1.5} />
        )}
        Revoke
      </button>
    </div>
  );
};

export default TokenCard;
