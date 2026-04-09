"use client";

import { AnimatePresence, motion } from "framer-motion";
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
  IconTag,
  IconX,
} from "@tabler/icons-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import Link from "./link-card/card";
import { BulkActionBar } from "./bulk-action-bar";
import { SelectionProvider, useSelection } from "./selection-context";

import type { RouterOutputs } from "@/trpc/shared";

type LinksProps = {
  links: RouterOutputs["link"]["list"]["links"];
  totalLinks: number;
  totalPages: number;
  currentPage: number;
};

const LinksContent = ({
  links,
  totalPages,
  currentPage,
  totalLinks,
}: LinksProps) => {
  const router = useRouter();
  const urlSearchParams = useSearchParams();
  const {
    isSelectionMode,
    exitSelectionMode,
    selectAll,
    clearSelection,
    selectedLinkIds,
  } = useSelection();
  const [searchQuery, setSearchQuery] = useState(
    urlSearchParams.get("search") ?? "",
  );
  const [orderBy, setOrderBy] = useState(
    urlSearchParams.get("orderBy") ?? "createdAt",
  );
  const [orderDirection, setOrderDirection] = useState(
    urlSearchParams.get("orderDirection") ?? "desc",
  );
  const [archivedFilter, setArchivedFilter] = useState(
    urlSearchParams.get("archivedFilter") ?? "active",
  );
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);

  useEffect(() => {
    const tagFromUrl = urlSearchParams.get("tag");
    if (tagFromUrl) {
      setSelectedTags([tagFromUrl]);
    }
    const archivedFromUrl = urlSearchParams.get("archivedFilter");
    if (archivedFromUrl) {
      setArchivedFilter(archivedFromUrl);
    }
  }, [urlSearchParams]);

  useEffect(() => {
    const handler = setTimeout(() => {
      const params = new URLSearchParams(urlSearchParams.toString());
      const currentSearch = params.get("search") ?? "";

      if (searchQuery !== currentSearch) {
        if (searchQuery) {
          params.set("search", searchQuery);
        } else {
          params.delete("search");
        }
        params.set("page", "1");
        router.push(`/dashboard?${params.toString()}`);
      }
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery, router, urlSearchParams]);

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(urlSearchParams.toString());
    params.set("page", page.toString());
    router.push(`/dashboard?${params.toString()}`);
  };

  const handleOrderChange = (value: string) => {
    const [newOrderBy, newOrderDirection] = value.split("-");
    setOrderBy(newOrderBy!);
    setOrderDirection(newOrderDirection!);

    const params = new URLSearchParams(urlSearchParams.toString());
    params.set("orderBy", newOrderBy!);
    params.set("orderDirection", newOrderDirection!);
    router.push(`/dashboard?${params.toString()}`);
  };

  const handleArchivedFilterChange = (value: string) => {
    setArchivedFilter(value);

    const params = new URLSearchParams(urlSearchParams.toString());
    if (value === "all") {
      params.delete("archivedFilter");
    } else {
      params.set("archivedFilter", value);
    }
    params.set("page", "1");
    router.push(`/dashboard?${params.toString()}`);
  };

  const handleTagClick = (tag: string) => {
    setSelectedTags([tag]);

    const params = new URLSearchParams(urlSearchParams.toString());
    params.set("tag", tag);
    params.set("page", "1");
    router.push(`/dashboard?${params.toString()}`);
  };

  const removeTag = (tag: string) => {
    setSelectedTags(selectedTags.filter((t) => t !== tag));

    const params = new URLSearchParams(urlSearchParams.toString());
    params.delete("tag");
    params.set("page", "1");
    router.push(`/dashboard?${params.toString()}`);
  };

  useEffect(() => {
    const tags = new Set<string>();
    links.forEach((link) => {
      const linkTags = (link.tags as string[]) || [];
      linkTags.forEach((tag) => tags.add(tag));
    });
    setAllTags(Array.from(tags));
  }, [links]);

  const allSelected =
    selectedLinkIds.length === links.length && links.length > 0;

  const handleSelectAllToggle = () => {
    if (allSelected) {
      clearSelection();
    } else {
      selectAll(links.map((l) => l.id));
    }
  };

  return (
    <>
      {/* Filter bar */}
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
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>

        <Select
          onValueChange={handleArchivedFilterChange}
          value={archivedFilter}
        >
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
          onValueChange={(value) => {
            if (value !== "all") {
              handleTagClick(value);
            } else {
              setSelectedTags([]);
              const params = new URLSearchParams(urlSearchParams.toString());
              params.delete("tag");
              params.set("page", "1");
              router.push(`/dashboard?${params.toString()}`);
            }
          }}
          value={selectedTags.length > 0 ? selectedTags[0] : "all"}
        >
          <SelectTrigger className="h-9 w-full border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px] sm:w-[130px]">
            <SelectValue placeholder="Tags" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <IconTag
                size={14}
                stroke={1.5}
                className="mr-1.5 inline-block text-neutral-400"
              />
              All tags
            </SelectItem>
            {allTags.map((tag) => (
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

        <Select
          onValueChange={handleOrderChange}
          value={`${orderBy}-${orderDirection}`}
        >
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

      {/* Active tag filter */}
      {selectedTags.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-neutral-400">Filtered by:</span>
          {selectedTags.map((tag) => (
            <button
              key={tag}
              onClick={() => removeTag(tag)}
              className="inline-flex items-center gap-1 rounded-md border border-neutral-200 dark:border-border bg-white dark:bg-card px-2 py-0.5 text-[12px] font-medium text-neutral-600 dark:text-neutral-400 transition-colors hover:bg-neutral-50 dark:hover:bg-accent/50"
            >
              {tag}
              <IconX size={12} stroke={1.5} className="text-neutral-400" />
            </button>
          ))}
          <button
            onClick={() => {
              setSelectedTags([]);
              const params = new URLSearchParams(urlSearchParams.toString());
              params.delete("tag");
              params.set("page", "1");
              router.push(`/dashboard?${params.toString()}`);
            }}
            className="text-[12px] text-neutral-400 transition-colors hover:text-neutral-600"
          >
            Clear
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
                    {allSelected && (
                      <IconCheck
                        size={10}
                        stroke={3}
                        className="text-white"
                      />
                    )}
                  </div>
                  <span className="font-medium">
                    {allSelected
                      ? "Deselect all"
                      : `Select all (${links.length})`}
                  </span>
                </button>
                {selectedLinkIds.length > 0 && (
                  <span className="text-[12px] text-neutral-400">
                    {selectedLinkIds.length} selected
                  </span>
                )}
              </div>
              <button
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

      {/* Empty state */}
      {links.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100 dark:bg-muted">
            <IconSearch size={20} stroke={1.5} className="text-neutral-400" />
          </div>
          <p className="mt-4 text-[14px] font-medium text-neutral-900 dark:text-foreground">
            No links found
          </p>
          <p className="mt-1 text-[13px] text-neutral-400">
            Try adjusting your search or filters.
          </p>
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
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 dark:text-neutral-400 transition-colors hover:bg-neutral-100 dark:hover:bg-accent hover:text-neutral-900 dark:hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
            >
              <IconChevronLeft size={16} stroke={1.5} />
            </button>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 dark:text-neutral-400 transition-colors hover:bg-neutral-100 dark:hover:bg-accent hover:text-neutral-900 dark:hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
            >
              <IconChevronRight size={16} stroke={1.5} />
            </button>
          </div>
        </div>
      )}

      <BulkActionBar />
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
