"use client";

import { IconKey, IconTrash } from "@tabler/icons-react";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";

import { revalidateRoute } from "@/app/(main)/dashboard/revalidate-homepage";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { POSTHOG_EVENTS, trackEvent } from "@/lib/analytics/events";
import { api } from "@/trpc/react";

import type { RouterOutputs } from "@/trpc/shared";

type Token = RouterOutputs["token"]["list"][number];

const formatDate = (date: Date) =>
  date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

const TokenCard = ({ token, active = true }: { token: Token; active?: boolean }) => {
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Keys created before names were stored have none.
  const name = token.name ?? "API key";

  const deleteTokenMutation = api.token.delete.useMutation({
    onSuccess: async () => {
      trackEvent(POSTHOG_EVENTS.API_KEY_REVOKED);
      toast.success("API key revoked");
      setConfirmOpen(false);
      await revalidateRoute("/dashboard/settings");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-neutral-100 dark:bg-muted">
        <IconKey size={15} stroke={1.5} className="text-neutral-400 dark:text-muted-foreground" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-[13px] font-medium text-neutral-900 dark:text-foreground">
            {name}
          </p>
          {token.prefix && (
            <code className="flex-shrink-0 rounded-md bg-neutral-50 px-1.5 py-0.5 font-mono text-[11px] text-neutral-500 dark:bg-accent/50 dark:text-neutral-400">
              {token.prefix}••••
            </code>
          )}
          {active ? (
            <span className="inline-flex flex-shrink-0 items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Active
            </span>
          ) : (
            <span className="inline-flex flex-shrink-0 items-center gap-1 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-neutral-400 dark:bg-neutral-500" />
              Inactive
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-[12px] text-neutral-400 dark:text-muted-foreground">
          {token.createdAt && <>Created {formatDate(token.createdAt)} &middot; </>}
          {token.lastUsedAt ? (
            <span title={token.lastUsedAt.toLocaleString()}>
              Last used {formatDistanceToNow(token.lastUsedAt, { addSuffix: true })}
            </span>
          ) : (
            "Never used"
          )}
        </p>
      </div>

      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        aria-label={`Revoke ${name}`}
        className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-[12px] font-medium text-red-600 transition-colors hover:border-red-200 hover:bg-red-50 dark:border-border dark:text-red-400 dark:hover:border-red-800 dark:hover:bg-red-500/10"
      >
        <IconTrash size={13} stroke={1.5} />
        <span className="hidden sm:inline">Revoke</span>
      </button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="max-w-md rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[14px] font-semibold text-neutral-900 dark:text-foreground">
              Revoke API key?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[12px] text-neutral-500 dark:text-neutral-400">
              Requests using{" "}
              <span className="break-all font-medium text-neutral-700 dark:text-neutral-300">
                {name}
              </span>{" "}
              will fail immediately. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg border-neutral-200 text-[13px] dark:border-border">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                deleteTokenMutation.mutate({ id: token.id });
              }}
              disabled={deleteTokenMutation.isLoading}
              className="rounded-lg bg-red-600 text-[13px] text-white hover:bg-red-700 disabled:opacity-50"
            >
              {deleteTokenMutation.isLoading ? "Revoking..." : "Revoke"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TokenCard;
