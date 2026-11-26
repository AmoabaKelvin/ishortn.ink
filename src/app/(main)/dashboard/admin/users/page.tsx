"use client";

import { IconAlertTriangle, IconBan, IconCheck, IconSearch } from "@tabler/icons-react";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { displayName } from "@/lib/utils/user-name";
import { api } from "@/trpc/react";

import { DateRangePicker } from "../_components/date-range-picker";
import { RecentSubscriptionsCard } from "./_components/recent-subscriptions-card";
import { SubscriptionGrowthChart } from "./_components/subscription-growth-chart";
import { TierBreakdownCard } from "./_components/tier-breakdown-card";
import { UserBaseStats } from "./_components/user-base-stats";

type ModerationAction = "ban" | "restrict";

type PendingModeration = {
  action: ModerationAction;
  user: { id: string; name: string | null; email: string | null; linkCount: number };
} | null;

const MODERATION_COPY = {
  ban: {
    title: "Ban User",
    description: "This will ban the user and immediately block all their links.",
    label: "Reason for banning",
    placeholder: "e.g. Repeated creation of phishing links...",
    submit: "Ban User",
    submitting: "Banning...",
  },
  restrict: {
    title: "Restrict User",
    description:
      "The user can still sign in and pay, but can't create or edit links, custom domains, bio pages or QR codes. Their custom domains are removed from Cloudflare until the restriction is lifted.",
    label: "Reason for restricting",
    placeholder: "e.g. Custom domain used to host phishing pages...",
    submit: "Restrict User",
    submitting: "Restricting...",
  },
} as const;

function getDefault30d() {
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  const from = new Date();
  from.setDate(from.getDate() - 29);
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

export default function AdminUsersPage() {
  const [dateRange, setDateRange] = useState(getDefault30d);

  const [query, setQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<PendingModeration>(null);
  const [reason, setReason] = useState("");

  const { from, to } = dateRange;

  const { data: summary, isLoading: summaryLoading } = api.admin.getUserBaseSummary.useQuery(
    { from, to },
    { keepPreviousData: true },
  );

  const { data: timeline, isLoading: timelineLoading } = api.admin.getSubscriptionTimeline.useQuery(
    { from, to },
    { keepPreviousData: true },
  );

  const { data: recentSubs, isLoading: recentSubsLoading } =
    api.admin.getRecentSubscriptions.useQuery({ limit: 10 });

  const { data, refetch, isLoading } = api.admin.searchUsers.useQuery(
    { query: searchQuery, page, pageSize: 20 },
    { enabled: searchQuery.length > 0 },
  );

  const banMutation = api.admin.banUser.useMutation({
    onSuccess: () => {
      toast.success("User banned and all their links blocked");
      closeDialog();
      void refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const unbanMutation = api.admin.unbanUser.useMutation({
    onSuccess: () => {
      toast.success("User unbanned and ban-blocked links restored");
      void refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const restrictMutation = api.admin.restrictUser.useMutation({
    onSuccess: ({ domainFailures }) => {
      if (domainFailures.length > 0) {
        toast.warning(
          `User restricted, but these domains could not be removed: ${domainFailures.join(", ")}`,
        );
      } else {
        toast.success("User restricted and their custom domains removed");
      }
      closeDialog();
      void refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const unrestrictMutation = api.admin.unrestrictUser.useMutation({
    onSuccess: ({ domainFailures }) => {
      if (domainFailures.length > 0) {
        toast.warning(
          `Restriction lifted, but these domains could not be re-added: ${domainFailures.join(", ")}`,
        );
      } else {
        toast.success("Restriction lifted and custom domains re-added");
      }
      void refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  function closeDialog() {
    setPending(null);
    setReason("");
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearchQuery(query);
  };

  const handleConfirm = () => {
    if (!pending || !reason.trim()) return;
    const mutation = pending.action === "ban" ? banMutation : restrictMutation;
    mutation.mutate({ userId: pending.user.id, reason: reason.trim() });
  };

  const copy = MODERATION_COPY[pending?.action ?? "ban"];
  const isSubmitting = banMutation.isLoading || restrictMutation.isLoading;

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-foreground">
            Users
          </h1>
          <p className="mt-1 text-[13px] text-neutral-400 dark:text-muted-foreground">
            User base overview and account management
          </p>
        </div>
        <DateRangePicker from={from} to={to} onChange={setDateRange} />
      </div>

      <UserBaseStats data={summary} isLoading={summaryLoading} />

      <div className="mt-4">
        <SubscriptionGrowthChart data={timeline} isLoading={timelineLoading} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TierBreakdownCard data={summary?.tiers} isLoading={summaryLoading} />
        <RecentSubscriptionsCard data={recentSubs} isLoading={recentSubsLoading} />
      </div>

      <div className="mt-10 mb-4 border-t border-neutral-200 dark:border-border/50" />

      <div className="mb-6">
        <h2 className="text-[15px] font-semibold tracking-tight text-neutral-900 dark:text-foreground">
          Find a user
        </h2>
        <p className="mt-1 text-[12px] text-neutral-400 dark:text-muted-foreground">
          Search by email or name to manage bans and restrictions
        </p>
      </div>

      <form onSubmit={handleSearch} className="mb-6 flex gap-2">
        <div className="relative flex-1">
          <IconSearch
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by email or name..."
            className="pl-9"
          />
        </div>
        <Button type="submit" disabled={!query}>
          Search
        </Button>
      </form>

      {!searchQuery && (
        <div className="rounded-lg border border-dashed border-neutral-300 dark:border-border bg-neutral-50/50 dark:bg-accent/50 px-4 py-12 text-center">
          <IconSearch
            size={32}
            stroke={1.5}
            className="mx-auto mb-3 text-neutral-300 dark:text-neutral-600"
          />
          <p className="text-[13px] font-medium text-neutral-500 dark:text-neutral-400">
            Search for users to manage
          </p>
          <p className="mt-1 text-[12px] text-neutral-400 dark:text-muted-foreground">
            Enter a user&apos;s email address or name
          </p>
        </div>
      )}

      {isLoading && searchQuery && (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-neutral-100 dark:bg-muted" />
          ))}
        </div>
      )}

      {data && searchQuery && data.users.length === 0 && (
        <div className="rounded-lg border border-dashed border-neutral-300 dark:border-border bg-neutral-50/50 dark:bg-accent/50 px-4 py-12 text-center">
          <p className="text-[13px] font-medium text-neutral-500 dark:text-neutral-400">
            No users found for &ldquo;{searchQuery}&rdquo;
          </p>
          <p className="mt-1 text-[12px] text-neutral-400 dark:text-muted-foreground">
            Try a different search term
          </p>
        </div>
      )}

      {data && data.users.length > 0 && (
        <>
          <p className="mb-3 text-[12px] text-neutral-400 dark:text-muted-foreground">
            {data.total} {data.total === 1 ? "result" : "results"} found
          </p>

          <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-border">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-border bg-neutral-50 dark:bg-accent/50">
                  <th className="px-4 py-3 font-medium text-neutral-500 dark:text-neutral-400">
                    User
                  </th>
                  <th className="hidden px-4 py-3 font-medium text-neutral-500 dark:text-neutral-400 md:table-cell">
                    Links
                  </th>
                  <th className="hidden px-4 py-3 font-medium text-neutral-500 dark:text-neutral-400 lg:table-cell">
                    Joined
                  </th>
                  <th className="px-4 py-3 font-medium text-neutral-500 dark:text-neutral-400">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-neutral-500 dark:text-neutral-400">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-border/50">
                {data.users.map((u) => (
                  <tr key={u.id} className="hover:bg-neutral-50/50 dark:hover:bg-accent/50">
                    <td className="px-4 py-3">
                      <p className="text-[13px] font-medium text-neutral-800 dark:text-neutral-200">
                        {displayName(u.name) ?? "Unnamed"}
                      </p>
                      <p className="text-[11px] text-neutral-400 dark:text-muted-foreground">
                        {u.email}
                      </p>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <p className="text-[12px] text-neutral-500 dark:text-neutral-400">
                        {u.linkCount}
                      </p>
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      <p className="text-[12px] text-neutral-500 dark:text-neutral-400">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "N/A"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {u.banned ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-red-50 dark:bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:text-red-400"
                          title={u.bannedReason ?? undefined}
                        >
                          <IconBan size={11} />
                          Banned
                        </span>
                      ) : u.restrictedAt ? (
                        <>
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                            <IconAlertTriangle size={11} />
                            Restricted
                          </span>
                          {u.restrictedReason && (
                            <p className="mt-1 line-clamp-2 max-w-48 break-words text-[11px] text-neutral-500 dark:text-neutral-400">
                              {u.restrictedReason}
                            </p>
                          )}
                        </>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 dark:bg-green-500/10 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:text-green-400">
                          <IconCheck size={11} />
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {u.banned ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => unbanMutation.mutate({ userId: u.id })}
                          disabled={unbanMutation.isLoading}
                          className="h-7 text-[12px]"
                        >
                          Unban
                        </Button>
                      ) : (
                        <div className="flex flex-col items-end gap-1.5 sm:flex-row sm:justify-end">
                          {u.restrictedAt ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => unrestrictMutation.mutate({ userId: u.id })}
                              disabled={unrestrictMutation.isLoading}
                              className="h-7 text-[12px]"
                            >
                              Unrestrict
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setPending({
                                  action: "restrict",
                                  user: {
                                    id: u.id,
                                    name: u.name,
                                    email: u.email,
                                    linkCount: u.linkCount,
                                  },
                                })
                              }
                              className="h-7 text-[12px]"
                            >
                              Restrict
                            </Button>
                          )}
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() =>
                              setPending({
                                action: "ban",
                                user: {
                                  id: u.id,
                                  name: u.name,
                                  email: u.email,
                                  linkCount: u.linkCount,
                                },
                              })
                            }
                            className="h-7 text-[12px]"
                          >
                            Ban
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-[12px] text-neutral-400 dark:text-muted-foreground">
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

      <Dialog
        open={!!pending}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>{copy.description}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="rounded-lg bg-neutral-50 dark:bg-accent/50 p-3">
              <p className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                {displayName(pending?.user.name) ?? "Unnamed"}
              </p>
              <p className="text-[12px] text-neutral-400 dark:text-muted-foreground">
                {pending?.user.email}
              </p>
              {pending?.action === "ban" && pending.user.linkCount > 0 && (
                <p className="mt-1.5 text-[11px] font-medium text-red-600 dark:text-red-400">
                  {pending.user.linkCount} {pending.user.linkCount === 1 ? "link" : "links"} will be
                  blocked
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="moderation-reason"
                className="mb-1.5 block text-[13px] font-medium text-neutral-700 dark:text-neutral-300"
              >
                {copy.label}
              </label>
              <Textarea
                id="moderation-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={255}
                placeholder={copy.placeholder}
                rows={3}
                className="text-[13px]"
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={!reason.trim() || isSubmitting}
            >
              {isSubmitting ? copy.submitting : copy.submit}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
