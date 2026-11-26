"use client";

import { IconShieldCheck } from "@tabler/icons-react";
import { differenceInDays } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";

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
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/trpc/react";

import type { RouterOutputs } from "@/trpc/shared";

type HeldDomain = RouterOutputs["admin"]["getHeldDomains"][number];

const PLAN_LABELS = { free: "Free", pro: "Pro", ultra: "Ultra" } as const;

function accountAge(createdAt: Date | null) {
  if (!createdAt) return "Account age unknown";
  const days = differenceInDays(new Date(), createdAt);
  if (days === 0) return "Created today";
  return `${days.toLocaleString()} ${days === 1 ? "day" : "days"} old`;
}

function formatDate(date: Date | null) {
  return date ? new Date(date).toLocaleDateString() : "Unknown";
}

export function HeldDomains() {
  const [rejecting, setRejecting] = useState<HeldDomain | null>(null);
  const [reason, setReason] = useState("");

  const utils = api.useUtils();
  const { data: domains, isLoading, isError, error } = api.admin.getHeldDomains.useQuery();

  const approveMutation = api.admin.approveHeldDomain.useMutation({
    onSuccess: (result) => {
      toast.success(
        result.status === "active" ? "Domain approved and live" : "Domain approved, waiting on DNS",
      );
      void utils.admin.getHeldDomains.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const rejectMutation = api.admin.rejectHeldDomain.useMutation({
    onSuccess: (result) => {
      toast.success(
        result.hostnameReleased
          ? "Domain rejected"
          : "Domain rejected. Its Cloudflare hostname was kept: it's shared or the release failed.",
      );
      setRejecting(null);
      setReason("");
      void utils.admin.getHeldDomains.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const busyId = approveMutation.isLoading
    ? approveMutation.variables?.id
    : rejectMutation.isLoading
      ? rejectMutation.variables?.id
      : undefined;

  return (
    <section className="mb-10">
      <div className="mb-4">
        <h2 className="text-[14px] font-semibold text-neutral-900 dark:text-foreground">
          Held for review
        </h2>
        <p className="mt-1 text-[12px] text-neutral-500 dark:text-neutral-400">
          Custom domains added by new accounts whose domain was registered recently. They stay
          inactive until approved.
        </p>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      )}

      {isError && (
        <p className="rounded-lg border border-neutral-200 px-4 py-3 text-[13px] text-red-600 dark:border-border dark:text-red-400">
          {error.message || "Couldn't load held domains."}
        </p>
      )}

      {domains && domains.length === 0 && (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50/50 px-4 py-10 text-center dark:border-border dark:bg-accent/50">
          <IconShieldCheck
            size={32}
            stroke={1.5}
            className="mx-auto mb-3 text-neutral-300 dark:text-neutral-600"
          />
          <p className="text-[13px] font-medium text-neutral-500 dark:text-neutral-400">
            No domains waiting for review
          </p>
        </div>
      )}

      {domains && domains.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-border">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 dark:border-border dark:bg-accent/50">
                <th className="px-4 py-3 font-medium text-neutral-500 dark:text-neutral-400">
                  Domain
                </th>
                <th className="hidden px-4 py-3 font-medium text-neutral-500 dark:text-neutral-400 md:table-cell">
                  Owner
                </th>
                <th className="hidden px-4 py-3 font-medium text-neutral-500 dark:text-neutral-400 lg:table-cell">
                  Registered
                </th>
                <th className="px-4 py-3 text-right font-medium text-neutral-500 dark:text-neutral-400">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-border/50">
              {domains.map((d) => (
                <tr key={d.id} className="align-top hover:bg-neutral-50/50 dark:hover:bg-accent/50">
                  <td className="px-4 py-3">
                    <p className="break-all font-medium text-neutral-900 dark:text-foreground">
                      {d.domain}
                    </p>
                    <p className="mt-0.5 text-[12px] text-neutral-500 dark:text-neutral-400">
                      {d.reviewReason}
                    </p>
                    {/* Owner and registration move under the domain on small screens */}
                    <p className="mt-0.5 text-[12px] text-neutral-400 dark:text-muted-foreground md:hidden">
                      <span className="break-all">{d.ownerEmail ?? "Unknown owner"}</span> &middot;{" "}
                      {accountAge(d.ownerCreatedAt)} &middot; {PLAN_LABELS[d.plan]}
                    </p>
                    <p className="mt-0.5 break-words text-[12px] text-neutral-400 dark:text-muted-foreground lg:hidden">
                      Registered {formatDate(d.registeredAt)} &middot;{" "}
                      {d.registrar ?? "Unknown registrar"}
                    </p>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <p className="break-all text-neutral-700 dark:text-neutral-300">
                      {d.ownerEmail ?? "Unknown owner"}
                    </p>
                    <p className="mt-0.5 text-[12px] text-neutral-500 dark:text-neutral-400">
                      {accountAge(d.ownerCreatedAt)} &middot; {PLAN_LABELS[d.plan]}
                    </p>
                  </td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    <p className="tabular-nums text-neutral-700 dark:text-neutral-300">
                      {formatDate(d.registeredAt)}
                    </p>
                    <p className="mt-0.5 break-words text-[12px] text-neutral-500 dark:text-neutral-400">
                      {d.registrar ?? "Unknown registrar"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-end gap-1.5 sm:flex-row sm:justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-[12px]"
                        disabled={busyId === d.id}
                        onClick={() => approveMutation.mutate({ id: d.id })}
                        aria-label={`Approve ${d.domain}`}
                      >
                        {approveMutation.isLoading && busyId === d.id ? "Approving..." : "Approve"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[12px] text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                        disabled={busyId === d.id}
                        onClick={() => setRejecting(d)}
                        aria-label={`Reject ${d.domain}`}
                      >
                        Reject
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={rejecting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRejecting(null);
            setReason("");
          }
        }}
      >
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Reject domain</DialogTitle>
            <DialogDescription className="break-all">
              {rejecting?.domain} will be marked invalid and removed from Cloudflare. Its owner sees
              that it can&apos;t be connected.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-1.5">
            <Label htmlFor="reject-reason" className="text-[13px]">
              Reason
            </Label>
            <Textarea
              id="reject-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Lookalike of a bank's domain"
              maxLength={255}
              rows={2}
              className="text-[13px]"
            />
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={!reason.trim() || rejectMutation.isLoading}
              onClick={() => {
                if (rejecting) rejectMutation.mutate({ id: rejecting.id, reason: reason.trim() });
              }}
            >
              {rejectMutation.isLoading ? "Rejecting..." : "Reject domain"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
