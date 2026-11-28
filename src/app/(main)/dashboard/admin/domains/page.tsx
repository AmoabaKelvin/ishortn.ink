"use client";

import { IconPlus, IconTrash, IconWorld } from "@tabler/icons-react";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/trpc/react";

import { HeldDomains } from "./_components/held-domains";

export default function AdminDomainsPage() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [newReason, setNewReason] = useState("");
  const [pendingRemoval, setPendingRemoval] = useState<{ id: number; domain: string } | null>(null);

  const { data: domains, refetch } = api.admin.getBlockedDomains.useQuery();

  const addMutation = api.admin.addBlockedDomain.useMutation({
    onSuccess: () => {
      toast.success("Domain added to blocklist");
      setNewDomain("");
      setNewReason("");
      setIsAddOpen(false);
      void refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const removeMutation = api.admin.removeBlockedDomain.useMutation({
    onSuccess: () => {
      toast.success("Domain removed from blocklist");
      setPendingRemoval(null);
      void refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const handleAdd = () => {
    if (!newDomain.trim()) return;
    addMutation.mutate({
      domain: newDomain.trim(),
      reason: newReason.trim() || undefined,
    });
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-foreground">
          Domains
        </h1>
        <p className="mt-1 text-[13px] text-neutral-400 dark:text-muted-foreground">
          Review held custom domains and manage the link destination blocklist.
        </p>
      </div>

      <HeldDomains />

      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold text-neutral-900 dark:text-foreground">
            Blocked domains
          </h2>
          <p className="mt-1 text-[12px] text-neutral-500 dark:text-neutral-400">
            {domains
              ? `${domains.length.toLocaleString()} ${domains.length === 1 ? "domain" : "domains"} blocked`
              : "URLs from these domains will be rejected during link creation"}
          </p>
        </div>
        <Button className="shrink-0" onClick={() => setIsAddOpen(true)}>
          <IconPlus size={16} />
          Add Domain
        </Button>
      </div>

      {!domains && (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-neutral-100 dark:bg-muted" />
          ))}
        </div>
      )}

      {domains && domains.length === 0 && (
        <div className="rounded-lg border border-dashed border-neutral-300 dark:border-border bg-neutral-50/50 dark:bg-accent/50 px-4 py-12 text-center">
          <IconWorld
            size={32}
            stroke={1.5}
            className="mx-auto mb-3 text-neutral-300 dark:text-neutral-600"
          />
          <p className="text-[13px] font-medium text-neutral-500 dark:text-neutral-400">
            No blocked domains yet
          </p>
          <p className="mt-1 text-[12px] text-neutral-400 dark:text-muted-foreground">
            Add domains to prevent users from shortening URLs from those sites
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => setIsAddOpen(true)}>
            <IconPlus size={14} />
            Add your first domain
          </Button>
        </div>
      )}

      {domains && domains.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-border">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-border bg-neutral-50 dark:bg-accent/50">
                <th className="px-4 py-3 font-medium text-neutral-500 dark:text-neutral-400">
                  Domain
                </th>
                <th className="hidden px-4 py-3 font-medium text-neutral-500 dark:text-neutral-400 md:table-cell">
                  Reason
                </th>
                <th className="hidden px-4 py-3 font-medium text-neutral-500 dark:text-neutral-400 lg:table-cell">
                  Added
                </th>
                <th className="px-4 py-3 text-right font-medium text-neutral-500 dark:text-neutral-400">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-border/50">
              {domains.map((d) => (
                <tr key={d.id} className="hover:bg-neutral-50/50 dark:hover:bg-accent/50">
                  <td className="px-4 py-3">
                    <code className="rounded bg-neutral-100 dark:bg-muted px-1.5 py-0.5 text-[12px] text-neutral-700 dark:text-neutral-300">
                      {d.domain}
                    </code>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <p className="max-w-[300px] truncate text-[12px] text-neutral-500 dark:text-neutral-400">
                      {d.reason || "-"}
                    </p>
                  </td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    <p className="text-[12px] text-neutral-500 dark:text-neutral-400">
                      {d.createdAt ? new Date(d.createdAt).toLocaleDateString() : "N/A"}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                      onClick={() => setPendingRemoval({ id: d.id, domain: d.domain })}
                      aria-label={`Unblock ${d.domain}`}
                    >
                      <IconTrash size={14} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog
        open={pendingRemoval !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRemoval(null);
        }}
      >
        <AlertDialogContent className="max-w-md rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[14px] font-semibold text-neutral-900 dark:text-foreground">
              Unblock domain?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[12px] text-neutral-500 dark:text-neutral-400">
              New links to{" "}
              <span className="font-medium break-all text-neutral-700 dark:text-neutral-300">
                {pendingRemoval?.domain}
              </span>{" "}
              will be accepted again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg border-neutral-200 text-[13px] dark:border-border">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (pendingRemoval) removeMutation.mutate({ id: pendingRemoval.id });
              }}
              disabled={removeMutation.isLoading}
              className="rounded-lg bg-red-600 text-[13px] text-white hover:bg-red-700 disabled:opacity-50"
            >
              {removeMutation.isLoading ? "Unblocking..." : "Unblock"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add domain dialog */}
      <Dialog
        open={isAddOpen}
        onOpenChange={(open) => {
          if (!open) {
            setNewDomain("");
            setNewReason("");
          }
          setIsAddOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Block a Domain</DialogTitle>
            <DialogDescription>
              Any new links pointing to this domain will be automatically rejected.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div>
              <label
                htmlFor="blocked-domain"
                className="mb-1.5 block text-[13px] font-medium text-neutral-700 dark:text-neutral-300"
              >
                Domain
              </label>
              <Input
                id="blocked-domain"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="e.g. evil-phishing.com"
                className="text-[13px]"
              />
              <p className="mt-1 text-[11px] text-neutral-400 dark:text-muted-foreground">
                You can paste a full URL and the domain will be extracted automatically.
              </p>
            </div>
            <div>
              <label
                htmlFor="blocked-domain-reason"
                className="mb-1.5 block text-[13px] font-medium text-neutral-700 dark:text-neutral-300"
              >
                Reason (optional)
              </label>
              <Textarea
                id="blocked-domain-reason"
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                placeholder="e.g. Known phishing domain reported by Cloudflare..."
                rows={2}
                className="text-[13px]"
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={!newDomain.trim() || addMutation.isLoading}>
              {addMutation.isLoading ? "Adding..." : "Block Domain"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
