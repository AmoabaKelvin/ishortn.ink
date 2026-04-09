"use client";

import { IconBan, IconCheck, IconSearch } from "@tabler/icons-react";
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
import { api } from "@/trpc/react";

type UserToBan = {
  id: string;
  name: string | null;
  email: string | null;
  linkCount: number;
} | null;

export default function AdminUsersPage() {
  const [query, setQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [userToBan, setUserToBan] = useState<UserToBan>(null);
  const [banReason, setBanReason] = useState("");

  const { data, refetch, isLoading } = api.admin.searchUsers.useQuery(
    { query: searchQuery, page, pageSize: 20 },
    { enabled: searchQuery.length > 0 },
  );

  const banMutation = api.admin.banUser.useMutation({
    onSuccess: () => {
      toast.success("User banned and all their links blocked");
      setUserToBan(null);
      setBanReason("");
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearchQuery(query);
  };

  const handleBan = () => {
    if (!userToBan || !banReason.trim()) return;
    banMutation.mutate({ userId: userToBan.id, reason: banReason.trim() });
  };

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-foreground">
          Manage Users
        </h1>
        <p className="mt-1 text-[13px] text-neutral-400 dark:text-neutral-500">
          Search users and manage account bans
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

      {/* Empty state before search */}
      {!searchQuery && (
        <div className="rounded-lg border border-dashed border-neutral-300 dark:border-border bg-neutral-50/50 dark:bg-accent/50 px-4 py-12 text-center">
          <IconSearch size={32} stroke={1.5} className="mx-auto mb-3 text-neutral-300 dark:text-neutral-600" />
          <p className="text-[13px] font-medium text-neutral-500 dark:text-neutral-400">
            Search for users to manage
          </p>
          <p className="mt-1 text-[12px] text-neutral-400 dark:text-neutral-500">
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
          <p className="mt-1 text-[12px] text-neutral-400 dark:text-neutral-500">
            Try a different search term
          </p>
        </div>
      )}

      {data && data.users.length > 0 && (
        <>
          <p className="mb-3 text-[12px] text-neutral-400 dark:text-neutral-500">
            {data.total} {data.total === 1 ? "result" : "results"} found
          </p>

          <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-border">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-border bg-neutral-50 dark:bg-accent/50">
                  <th className="px-4 py-3 font-medium text-neutral-500 dark:text-neutral-400">User</th>
                  <th className="hidden px-4 py-3 font-medium text-neutral-500 dark:text-neutral-400 md:table-cell">Links</th>
                  <th className="hidden px-4 py-3 font-medium text-neutral-500 dark:text-neutral-400 lg:table-cell">Joined</th>
                  <th className="px-4 py-3 font-medium text-neutral-500 dark:text-neutral-400">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-neutral-500 dark:text-neutral-400">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-border/50">
                {data.users.map((u) => (
                  <tr key={u.id} className="hover:bg-neutral-50/50 dark:hover:bg-accent/50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-[13px] font-medium text-neutral-800 dark:text-neutral-200">
                          {u.name ?? "Unnamed"}
                        </p>
                        <p className="text-[11px] text-neutral-400 dark:text-neutral-500">{u.email}</p>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <p className="text-[12px] text-neutral-500 dark:text-neutral-400">{u.linkCount}</p>
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      <p className="text-[12px] text-neutral-500 dark:text-neutral-400">
                        {u.createdAt
                          ? new Date(u.createdAt).toLocaleDateString()
                          : "N/A"}
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
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setUserToBan({
                            id: u.id,
                            name: u.name,
                            email: u.email,
                            linkCount: u.linkCount,
                          })}
                          className="h-7 text-[12px]"
                        >
                          Ban
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-[12px] text-neutral-400 dark:text-neutral-500">
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

      {/* Ban dialog */}
      <Dialog open={!!userToBan} onOpenChange={(open) => { if (!open) { setUserToBan(null); setBanReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ban User</DialogTitle>
            <DialogDescription>
              This will ban the user and immediately block all their links.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="rounded-lg bg-neutral-50 dark:bg-accent/50 p-3">
              <p className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                {userToBan?.name ?? "Unnamed"}
              </p>
              <p className="text-[12px] text-neutral-400 dark:text-neutral-500">
                {userToBan?.email}
              </p>
              {userToBan && userToBan.linkCount > 0 && (
                <p className="mt-1.5 text-[11px] font-medium text-red-600 dark:text-red-400">
                  {userToBan.linkCount} {userToBan.linkCount === 1 ? "link" : "links"} will be blocked
                </p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                Reason for banning
              </label>
              <Textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="e.g. Repeated creation of phishing links..."
                rows={3}
                className="text-[13px]"
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setUserToBan(null); setBanReason(""); }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBan}
              disabled={!banReason.trim() || banMutation.isLoading}
            >
              {banMutation.isLoading ? "Banning..." : "Ban User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
