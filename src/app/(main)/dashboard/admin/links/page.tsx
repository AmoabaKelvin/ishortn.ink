"use client";

import {
  IconBan,
  IconCheck,
  IconExternalLink,
  IconSearch,
} from "@tabler/icons-react";
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

type LinkToBlock = {
  id: number;
  url: string | null;
  alias: string | null;
  domain: string;
} | null;

export default function AdminLinksPage() {
  const [query, setQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [linkToBlock, setLinkToBlock] = useState<LinkToBlock>(null);
  const [blockReason, setBlockReason] = useState("");

  const { data, refetch, isLoading } = api.admin.searchLinks.useQuery(
    { query: searchQuery, page, pageSize: 20 },
    { enabled: searchQuery.length > 0 },
  );

  const blockMutation = api.admin.blockLink.useMutation({
    onSuccess: () => {
      toast.success("Link blocked successfully");
      setLinkToBlock(null);
      setBlockReason("");
      void refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const unblockMutation = api.admin.unblockLink.useMutation({
    onSuccess: () => {
      toast.success("Link unblocked");
      void refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearchQuery(query);
  };

  const handleBlock = () => {
    if (!linkToBlock || !blockReason.trim()) return;
    blockMutation.mutate({ linkId: linkToBlock.id, reason: blockReason.trim() });
  };

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
          Manage Links
        </h1>
        <p className="mt-1 text-[13px] text-neutral-400">
          Search and moderate links across the platform
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
            placeholder="Search by URL, alias, domain, or user email..."
            className="pl-9"
          />
        </div>
        <Button type="submit" disabled={!query}>
          Search
        </Button>
      </form>

      {/* Empty state before search */}
      {!searchQuery && (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50/50 px-4 py-12 text-center">
          <IconSearch size={32} stroke={1.5} className="mx-auto mb-3 text-neutral-300" />
          <p className="text-[13px] font-medium text-neutral-500">
            Search for links to manage
          </p>
          <p className="mt-1 text-[12px] text-neutral-400">
            Enter a URL, short link alias, domain, or user email address
          </p>
        </div>
      )}

      {isLoading && searchQuery && (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-neutral-100" />
          ))}
        </div>
      )}

      {data && searchQuery && data.links.length === 0 && (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50/50 px-4 py-12 text-center">
          <p className="text-[13px] font-medium text-neutral-500">
            No links found for &ldquo;{searchQuery}&rdquo;
          </p>
          <p className="mt-1 text-[12px] text-neutral-400">
            Try a different search term
          </p>
        </div>
      )}

      {data && data.links.length > 0 && (
        <>
          <p className="mb-3 text-[12px] text-neutral-400">
            {data.total} {data.total === 1 ? "result" : "results"} found
          </p>

          <div className="overflow-hidden rounded-lg border border-neutral-200">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  <th className="px-4 py-3 font-medium text-neutral-500">Link</th>
                  <th className="hidden px-4 py-3 font-medium text-neutral-500 md:table-cell">User</th>
                  <th className="hidden px-4 py-3 font-medium text-neutral-500 lg:table-cell">Created</th>
                  <th className="px-4 py-3 font-medium text-neutral-500">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-neutral-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {data.links.map((link) => (
                  <tr key={link.id} className="group hover:bg-neutral-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-neutral-800">
                            <span className="text-neutral-400">{link.domain}/</span>
                            {link.alias}
                          </p>
                          <p className="max-w-[320px] truncate text-[11px] text-neutral-400">
                            {link.url}
                          </p>
                        </div>
                        <a
                          href={link.url ?? "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                          title="Open destination URL"
                        >
                          <IconExternalLink size={14} className="text-neutral-400 hover:text-neutral-600" />
                        </a>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <p className="text-[12px] text-neutral-500">{link.userEmail ?? "Unknown"}</p>
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      <p className="text-[12px] text-neutral-500">
                        {link.createdAt
                          ? new Date(link.createdAt).toLocaleDateString()
                          : "N/A"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {link.blocked ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700"
                          title={link.blockedReason ?? undefined}
                        >
                          <IconBan size={11} />
                          Blocked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
                          <IconCheck size={11} />
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {link.blocked ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => unblockMutation.mutate({ linkId: link.id })}
                          disabled={unblockMutation.isLoading}
                          className="h-7 text-[12px]"
                        >
                          Unblock
                        </Button>
                      ) : (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setLinkToBlock({
                            id: link.id,
                            url: link.url,
                            alias: link.alias,
                            domain: link.domain,
                          })}
                          className="h-7 text-[12px]"
                        >
                          Block
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

      {/* Block dialog */}
      <Dialog open={!!linkToBlock} onOpenChange={(open) => { if (!open) { setLinkToBlock(null); setBlockReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Block Link</DialogTitle>
            <DialogDescription>
              This will immediately prevent anyone from accessing this short link.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="rounded-lg bg-neutral-50 p-3">
              <p className="text-[13px] font-medium text-neutral-700">
                <span className="text-neutral-400">{linkToBlock?.domain}/</span>
                {linkToBlock?.alias}
              </p>
              <p className="mt-0.5 truncate text-[12px] text-neutral-400">
                {linkToBlock?.url}
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-neutral-700">
                Reason for blocking
              </label>
              <Textarea
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="e.g. Reported as phishing by hosting provider..."
                rows={3}
                className="text-[13px]"
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setLinkToBlock(null); setBlockReason(""); }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBlock}
              disabled={!blockReason.trim() || blockMutation.isLoading}
            >
              {blockMutation.isLoading ? "Blocking..." : "Block Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
