"use client";

import {
  IconDots,
  IconKey,
  IconList,
  IconPencil,
  IconPlayerPause,
  IconPlayerPlay,
  IconSend,
  IconTrash,
  IconWebhook,
} from "@tabler/icons-react";
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/trpc/react";

import { WebhookDeliveriesDialog } from "./webhook-deliveries-dialog";
import { pluralize } from "./webhook-events";
import { WebhookFormDialog } from "./webhook-form-dialog";
import { WebhookSecret } from "./webhook-secret";

import type { RouterOutputs } from "@/trpc/shared";

type Endpoint = RouterOutputs["webhook"]["list"]["endpoints"][number];

function EndpointStatus({ endpoint }: { endpoint: Endpoint }) {
  if (!endpoint.enabled) {
    return endpoint.disabledAt ? (
      <span className="inline-flex flex-shrink-0 items-center gap-1 text-[11px] font-medium text-red-600 dark:text-red-400">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500" />
        Disabled after failures
      </span>
    ) : (
      <span className="inline-flex flex-shrink-0 items-center gap-1 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-neutral-400 dark:bg-neutral-500" />
        Paused
      </span>
    );
  }
  if (endpoint.consecutiveFailures > 0) {
    return (
      <span className="inline-flex flex-shrink-0 items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
        Failing
      </span>
    );
  }
  return (
    <span className="inline-flex flex-shrink-0 items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Active
    </span>
  );
}

export function WebhookRow({
  endpoint,
  canManage,
  canSend,
}: {
  endpoint: Endpoint;
  canManage: boolean;
  // False when the plan has no webhooks (endpoints kept after a downgrade).
  canSend: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deliveriesOpen, setDeliveriesOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [rollOpen, setRollOpen] = useState(false);
  const [rolledSecret, setRolledSecret] = useState<string | null>(null);

  const sendTest = api.webhook.sendTest.useMutation({
    onSuccess: (result) => {
      if (result.ok) {
        toast.success(`Test event delivered (${result.responseStatus}, ${result.durationMs} ms)`);
      } else {
        toast.error(`Test event failed: ${result.error ?? "no response"}`);
      }
    },
    onError: (error) => toast.error(error.message),
  });

  const update = api.webhook.update.useMutation({
    onSuccess: async (_, input) => {
      toast.success(input.enabled ? "Endpoint turned on" : "Endpoint paused");
      await revalidateRoute("/dashboard/settings");
    },
    onError: (error) => toast.error(error.message),
  });

  const remove = api.webhook.delete.useMutation({
    onSuccess: async () => {
      toast.success("Endpoint deleted");
      setDeleteOpen(false);
      await revalidateRoute("/dashboard/settings");
    },
    onError: (error) => toast.error(error.message),
  });

  const roll = api.webhook.rollSecret.useMutation({
    onSuccess: (result) => setRolledSecret(result.secret),
    onError: (error) => toast.error(error.message),
  });

  const closeRoll = (open: boolean) => {
    setRollOpen(open);
    if (!open) setRolledSecret(null);
  };

  return (
    <div className="group flex items-center gap-3 px-4 py-3">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-neutral-100 dark:bg-muted">
        <IconWebhook
          size={15}
          stroke={1.5}
          className="text-neutral-400 dark:text-muted-foreground"
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p
            className="truncate font-mono text-[13px] font-medium text-neutral-900 dark:text-foreground"
            title={endpoint.url}
          >
            {endpoint.url}
          </p>
          <EndpointStatus endpoint={endpoint} />
        </div>
        <p className="mt-0.5 truncate text-[12px] text-neutral-400 dark:text-muted-foreground">
          {endpoint.description && <>{endpoint.description} &middot; </>}
          {pluralize(endpoint.events.length, "event")}
          {endpoint.enabled && endpoint.consecutiveFailures > 0 && (
            <> &middot; {pluralize(endpoint.consecutiveFailures, "failed attempt")} in a row</>
          )}
        </p>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Actions for ${endpoint.url}`}
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:text-muted-foreground dark:hover:bg-accent"
          >
            <IconDots size={16} stroke={1.5} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem className="text-[13px]" onClick={() => setDeliveriesOpen(true)}>
            <IconList size={14} stroke={1.5} className="mr-2" />
            View deliveries
          </DropdownMenuItem>
          {canManage && (
            <>
              {canSend && (
                <DropdownMenuItem
                  className="text-[13px]"
                  disabled={sendTest.isLoading}
                  onClick={() => sendTest.mutate({ id: endpoint.id })}
                >
                  <IconSend size={14} stroke={1.5} className="mr-2" />
                  {sendTest.isLoading ? "Sending..." : "Send test event"}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem className="text-[13px]" onClick={() => setEditOpen(true)}>
                <IconPencil size={14} stroke={1.5} className="mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-[13px]"
                disabled={update.isLoading}
                onClick={() => update.mutate({ id: endpoint.id, enabled: !endpoint.enabled })}
              >
                {endpoint.enabled ? (
                  <IconPlayerPause size={14} stroke={1.5} className="mr-2" />
                ) : (
                  <IconPlayerPlay size={14} stroke={1.5} className="mr-2" />
                )}
                {endpoint.enabled ? "Pause" : "Turn on"}
              </DropdownMenuItem>
              <DropdownMenuItem className="text-[13px]" onClick={() => setRollOpen(true)}>
                <IconKey size={14} stroke={1.5} className="mr-2" />
                Roll secret
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-[13px] text-red-600 dark:text-red-400"
                onClick={() => setDeleteOpen(true)}
              >
                <IconTrash size={14} stroke={1.5} className="mr-2" />
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <WebhookDeliveriesDialog
        webhookId={endpoint.id}
        url={endpoint.url}
        open={deliveriesOpen}
        onOpenChange={setDeliveriesOpen}
      />
      {canManage && (
        <WebhookFormDialog open={editOpen} onOpenChange={setEditOpen} endpoint={endpoint} />
      )}

      {/* Roll secret */}
      <Dialog open={rollOpen} onOpenChange={closeRoll}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>
              {rolledSecret ? "New signing secret" : "Roll signing secret?"}
            </DialogTitle>
            <DialogDescription>
              {rolledSecret
                ? "Requests are signed with this secret from now on."
                : "The current secret stops working straight away. Update your server with the new one to keep verifying requests."}
            </DialogDescription>
          </DialogHeader>
          {rolledSecret && (
            <DialogBody>
              <WebhookSecret secret={rolledSecret} />
            </DialogBody>
          )}
          <DialogFooter>
            {rolledSecret ? (
              <Button
                type="button"
                onClick={() => closeRoll(false)}
                className="h-9 bg-blue-600 text-[13px] hover:bg-blue-700"
              >
                Done
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => closeRoll(false)}
                  className="h-9 text-[13px]"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={roll.isLoading}
                  onClick={() => roll.mutate({ id: endpoint.id })}
                  className="h-9 bg-blue-600 text-[13px] hover:bg-blue-700"
                >
                  {roll.isLoading ? "Rolling..." : "Roll secret"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="max-w-md rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[14px] font-semibold text-neutral-900 dark:text-foreground">
              Delete endpoint?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[12px] text-neutral-500 dark:text-neutral-400">
              <span className="break-all font-medium text-neutral-700 dark:text-neutral-300">
                {endpoint.url}
              </span>{" "}
              stops receiving events and its delivery log is removed. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg border-neutral-200 text-[13px] dark:border-border">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                remove.mutate({ id: endpoint.id });
              }}
              disabled={remove.isLoading}
              className="rounded-lg bg-red-600 text-[13px] text-white hover:bg-red-700 disabled:opacity-50"
            >
              {remove.isLoading ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
