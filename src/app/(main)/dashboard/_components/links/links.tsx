"use client";

import {
  IconArchive,
  IconArchiveOff,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconFilter,
  IconSearch,
  IconSortAscending,
  IconSortDescending,
  IconSpeakerphone,
  IconTag,
  IconX,
} from "@tabler/icons-react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useEffectEvent, useOptimistic, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/trpc/react";

import { BulkActionBar } from "./bulk-action-bar";
import Link from "./link-card/card";
import { LinkReadyDialog } from "./link-ready-dialog";
import { QuickCreateLink } from "./quick-create-link";
import { SelectionProvider, useSelection } from "./selection-context";

import type { CreatedLink } from "./link-ready-dialog";
import type { RouterOutputs } from "@/trpc/shared";

type LinksProps = {
  links: RouterOutputs["link"]["list"]["links"];
  totalPages: number;
  currentPage: number;
  workspaceHasLinks: boolean;
  tags: string[];
};

type ArchivedFilter = "active" | "archived" | "all";

const parseArchivedFilter = (value: string | null): ArchivedFilter =>
  value === "archived" || value === "all" ? value : "active";

const LinksContent = ({ links, totalPages, currentPage, workspaceHasLinks, tags }: LinksProps) => {
  const router = useRouter();
  const urlSearchParams = useSearchParams();
  const { isSelectionMode, exitSelectionMode, selectAll, clearSelection, selectedLinkIds } =
    useSelection();

  // Filter state lives in the URL. While a navigation is in flight the
  // optimistic copy shows the new value, then falls back to the real URL.
  const [, startTransition] = useTransition();
  const [optimisticQuery, setOptimisticQuery] = useOptimistic(urlSearchParams.toString());
  const params = new URLSearchParams(optimisticQuery);
  const archivedFilter = parseArchivedFilter(params.get("archivedFilter"));
  const tagFilter = params.get("tag");
  const campaignFilter = params.get("campaign") ?? "all";
  const orderBy = params.get("orderBy") ?? "createdAt";
  const orderDirection = params.get("orderDirection") ?? "desc";
  const pendingSearch = params.get("search") ?? "";
  const hasFilters =
    pendingSearch !== "" ||
    tagFilter !== null ||
    campaignFilter !== "all" ||
    archivedFilter !== "active";

  /** Applies `updates` (null removes a key); any change other than paging goes back to page 1. */
  const navigate = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(optimisticQuery);
    next.delete("page");
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    const query = next.toString();
    startTransition(() => {
      setOptimisticQuery(query);
      router.push(query ? `/dashboard?${query}` : "/dashboard");
    });
  };

  // The search box needs local state for typing. It follows the URL (Back,
  // sidebar link) except when the URL change is our own debounced push, so
  // characters typed while that push was in flight are kept.
  const urlSearch = urlSearchParams.get("search") ?? "";
  const [searchQuery, setSearchQuery] = useState(urlSearch);
  const [syncedSearch, setSyncedSearch] = useState(urlSearch);
  const [pushedSearch, setPushedSearch] = useState<string | null>(null);
  if (urlSearch !== syncedSearch) {
    setSyncedSearch(urlSearch);
    if (urlSearch === pushedSearch) setPushedSearch(null);
    else setSearchQuery(urlSearch);
  }

  const pushSearch = useEffectEvent((query: string) => {
    setPushedSearch(query);
    navigate({ search: query || null });
  });

  useEffect(() => {
    if (searchQuery === pendingSearch) return;
    const handler = setTimeout(() => pushSearch(searchQuery), 500);
    return () => clearTimeout(handler);
  }, [searchQuery, pendingSearch]);

  // Selected ids only make sense for the rows on screen.
  const queryKey = urlSearchParams.toString();
  useEffect(() => {
    clearSelection();
  }, [queryKey, clearSelection]);

  const tagOptions = tagFilter && !tags.includes(tagFilter) ? [tagFilter, ...tags] : tags;

  const { data: campaigns } = api.campaign.listNames.useQuery(undefined, {
    staleTime: 60_000,
  });

  const handlePageChange = (page: number) => {
    navigate({ page: page > 1 ? page.toString() : null });
  };

  const handleOrderChange = (value: string) => {
    const [newOrderBy, newOrderDirection] = value.split("-");
    navigate({ orderBy: newOrderBy ?? null, orderDirection: newOrderDirection ?? null });
  };

  const handleArchivedFilterChange = (value: string) => {
    navigate({ archivedFilter: value === "active" ? null : value });
  };

  const handleCampaignFilterChange = (value: string) => {
    navigate({ campaign: value === "all" ? null : value });
  };

  const handleTagClick = (tag: string) => {
    navigate({ tag });
  };

  const clearTag = () => {
    navigate({ tag: null });
  };

  const clearFilters = () => {
    setSearchQuery("");
    navigate({ search: null, tag: null, campaign: null, archivedFilter: null });
  };

  // An empty workspace gets the quick-create panel instead of filters that
  // filter nothing. The created link is held here, not in the panel, because
  // the refresh that brings it into the list unmounts the panel.
  const [quickCreated, setQuickCreated] = useState<CreatedLink | null>(null);
  const isNewWorkspace = !workspaceHasLinks && !hasFilters;

  const allSelected = links.length > 0 && links.every((link) => selectedLinkIds.includes(link.id));

  const handleSelectAllToggle = () => {
    if (allSelected) {
      clearSelection();
    } else {
      selectAll(links.map((l) => l.id));
    }
  };

  return (
    <>
      {isNewWorkspace && <QuickCreateLink onCreated={setQuickCreated} />}
      <LinkReadyDialog
        link={quickCreated}
        onDone={() => setQuickCreated(null)}
        onCreateAnother={() => {
          setQuickCreated(null);
          router.push("/dashboard/link/new");
        }}
      />

      {/* Filter bar */}
      {workspaceHasLinks && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:flex-1">
            <IconSearch
              size={16}
              stroke={1.5}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            />
            <Input
              className="h-9 border-neutral-200 dark:border-border bg-white dark:bg-card pl-9 text-[13px] placeholder:text-neutral-400 focus-visible:ring-neutral-300"
              placeholder="Search links..."
              aria-label="Search links"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>

          <Select onValueChange={handleArchivedFilterChange} value={archivedFilter}>
            <SelectTrigger className="h-9 w-full border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px] sm:w-[130px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">
                <IconArchive
                  size={14}
                  stroke={1.5}
                  className="mr-1.5 inline-block text-neutral-400"
                />
                Active
              </SelectItem>
              <SelectItem value="archived">
                <IconArchiveOff
                  size={14}
                  stroke={1.5}
                  className="mr-1.5 inline-block text-neutral-400"
                />
                Archived
              </SelectItem>
              <SelectItem value="all">
                <IconFilter
                  size={14}
                  stroke={1.5}
                  className="mr-1.5 inline-block text-neutral-400"
                />
                All
              </SelectItem>
            </SelectContent>
          </Select>

          <Select
            onValueChange={(value) => (value === "all" ? clearTag() : handleTagClick(value))}
            value={tagFilter ?? "all"}
          >
            <SelectTrigger className="h-9 w-full border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px] sm:w-[130px]">
              <SelectValue placeholder="Tags" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <IconTag size={14} stroke={1.5} className="mr-1.5 inline-block text-neutral-400" />
                All tags
              </SelectItem>
              {tagOptions.map((tag) => (
                <SelectItem key={tag} value={tag}>
                  <IconTag
                    size={14}
                    stroke={1.5}
                    className="mr-1.5 inline-block text-neutral-400"
                  />
                  {tag}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {((campaigns?.length ?? 0) > 0 || campaignFilter !== "all") && (
            <Select onValueChange={handleCampaignFilterChange} value={campaignFilter}>
              <SelectTrigger className="h-9 w-full border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px] sm:w-[160px]">
                <SelectValue placeholder="Campaign" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <IconSpeakerphone
                    size={14}
                    stroke={1.5}
                    className="mr-1.5 inline-block text-neutral-400"
                  />
                  All campaigns
                </SelectItem>
                {campaigns?.map((campaign) => (
                  <SelectItem key={campaign.id} value={campaign.id.toString()}>
                    <IconSpeakerphone
                      size={14}
                      stroke={1.5}
                      className="mr-1.5 inline-block text-neutral-400"
                    />
                    {campaign.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select onValueChange={handleOrderChange} value={`${orderBy}-${orderDirection}`}>
            <SelectTrigger className="h-9 w-full border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px] sm:w-[170px]">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt-desc">
                <IconSortDescending
                  size={14}
                  stroke={1.5}
                  className="mr-1.5 inline-block text-neutral-400"
                />
                Newest first
              </SelectItem>
              <SelectItem value="createdAt-asc">
                <IconSortAscending
                  size={14}
                  stroke={1.5}
                  className="mr-1.5 inline-block text-neutral-400"
                />
                Oldest first
              </SelectItem>
              <SelectItem value="lastClicked-desc">
                <IconSortDescending
                  size={14}
                  stroke={1.5}
                  className="mr-1.5 inline-block text-neutral-400"
                />
                Recently clicked
              </SelectItem>
              <SelectItem value="lastClicked-asc">
                <IconSortAscending
                  size={14}
                  stroke={1.5}
                  className="mr-1.5 inline-block text-neutral-400"
                />
                Least recently clicked
              </SelectItem>
              <SelectItem value="totalClicks-desc">
                <IconSortDescending
                  size={14}
                  stroke={1.5}
                  className="mr-1.5 inline-block text-neutral-400"
                />
                Most clicks
              </SelectItem>
              <SelectItem value="totalClicks-asc">
                <IconSortAscending
                  size={14}
                  stroke={1.5}
                  className="mr-1.5 inline-block text-neutral-400"
                />
                Least clicks
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Active tag filter */}
      {tagFilter && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-neutral-400 dark:text-muted-foreground">
            Filtered by:
          </span>
          <button
            type="button"
            onClick={clearTag}
            aria-label={`Remove tag filter ${tagFilter}`}
            className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-md border border-neutral-200 dark:border-border bg-white dark:bg-card px-2 py-0.5 text-[12px] font-medium text-neutral-600 dark:text-neutral-400 transition-colors hover:bg-neutral-50 dark:hover:bg-accent/50"
          >
            <span className="truncate">{tagFilter}</span>
            <IconX size={12} stroke={1.5} className="shrink-0 text-neutral-400" />
          </button>
        </div>
      )}

      {/* Selection mode bar */}
      <AnimatePresence>
        {isSelectionMode && links.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: "auto", marginTop: 12 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex items-center justify-between rounded-lg border border-neutral-200 dark:border-border bg-white dark:bg-card px-4 py-2">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSelectAllToggle}
                  className="flex items-center gap-2 text-[13px] text-neutral-600 dark:text-neutral-400 transition-colors hover:text-neutral-900 dark:hover:text-foreground"
                >
                  <div
                    className={`flex h-4 w-4 items-center justify-center rounded border-[1.5px] transition-colors ${
                      allSelected
                        ? "border-blue-600 bg-blue-600"
                        : "border-neutral-300 bg-white dark:bg-card"
                    }`}
                  >
                    {allSelected && <IconCheck size={10} stroke={3} className="text-white" />}
                  </div>
                  <span className="font-medium">
                    {allSelected ? "Deselect all" : `Select all (${links.length})`}
                  </span>
                </button>
                {selectedLinkIds.length > 0 && (
                  <span className="text-[12px] text-neutral-400">
                    {selectedLinkIds.length} selected
                  </span>
                )}
              </div>
              <button
                type="button"
                aria-label="Exit selection mode"
                onClick={exitSelectionMode}
                className="rounded-md p-1 text-neutral-400 transition-colors hover:bg-neutral-50 dark:hover:bg-accent/50 hover:text-neutral-600"
              >
                <IconX size={16} stroke={1.5} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Link list */}
      <div className="mt-4 divide-y divide-neutral-300/60 dark:divide-border">
        <AnimatePresence>
          {links.map((link, index) => (
            <motion.div
              key={link.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2, delay: index * 0.03 }}
            >
              <Link link={link} onTagClick={handleTagClick} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Empty states */}
      {links.length === 0 && !isNewWorkspace && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-neutral-100 dark:bg-muted">
            {hasFilters ? (
              <IconSearch
                size={24}
                stroke={1.5}
                className="text-neutral-400 dark:text-muted-foreground"
              />
            ) : (
              <IconArchive
                size={24}
                stroke={1.5}
                className="text-neutral-400 dark:text-muted-foreground"
              />
            )}
          </div>
          <p className="mt-6 text-[14px] font-medium text-neutral-900 dark:text-foreground">
            {hasFilters ? "No links found" : "No active links"}
          </p>
          <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-neutral-400 dark:text-muted-foreground">
            {hasFilters
              ? "Try adjusting your search or filters."
              : "Archived links are hidden from this view. They still redirect."}
          </p>
          <div className="mt-6">
            {hasFilters ? (
              <Button
                type="button"
                variant="outline"
                onClick={clearFilters}
                className="h-9 border-neutral-200 dark:border-border text-[13px]"
              >
                Clear filters
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => handleArchivedFilterChange("archived")}
                className="h-9 border-neutral-200 dark:border-border text-[13px]"
              >
                Show archived links
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between border-t border-neutral-100 dark:border-border/50 pt-4">
          <p className="text-[12px] tabular-nums text-neutral-400">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous page"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 dark:text-neutral-400 transition-colors hover:bg-neutral-100 dark:hover:bg-accent hover:text-neutral-900 dark:hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
            >
              <IconChevronLeft size={16} stroke={1.5} />
            </button>
            <button
              type="button"
              aria-label="Next page"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 dark:text-neutral-400 transition-colors hover:bg-neutral-100 dark:hover:bg-accent hover:text-neutral-900 dark:hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
            >
              <IconChevronRight size={16} stroke={1.5} />
            </button>
          </div>
        </div>
      )}

      <BulkActionBar archivedFilter={archivedFilter} />
    </>
  );
};

export const Links = (props: LinksProps) => {
  return (
    <SelectionProvider>
      <LinksContent {...props} />
    </SelectionProvider>
  );
};
