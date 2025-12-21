"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Check,
  GalleryVerticalEnd,
  MousePointerClick,
  Tag,
  Tags,
  X,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

// Inner component that uses the selection context
const LinksContent = ({
  links,
  totalPages,
  currentPage,
  totalLinks,
}: LinksProps) => {
  const router = useRouter();
  const urlSearchParams = useSearchParams();
  const { isSelectionMode, enterSelectionMode, exitSelectionMode, selectAll, clearSelection, selectedLinkIds } = useSelection();
  const [searchQuery, setSearchQuery] = useState(
    urlSearchParams.get("search") ?? ""
  );
  const [orderBy, setOrderBy] = useState(
    urlSearchParams.get("orderBy") ?? "createdAt"
  );
  const [orderDirection, setOrderDirection] = useState(
    urlSearchParams.get("orderDirection") ?? "desc"
  );
  const [archivedFilter, setArchivedFilter] = useState(
    urlSearchParams.get("archivedFilter") ?? "active"
  );
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);

  // Initialize selectedTags and archivedFilter from URL on component mount
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

  // Debounce search query to transform URL
  useEffect(() => {
    const handler = setTimeout(() => {
      const params = new URLSearchParams(urlSearchParams.toString());
      const currentSearch = params.get("search") ?? "";

      // Only push if changed
      if (searchQuery !== currentSearch) {
        if (searchQuery) {
            params.set("search", searchQuery);
        } else {
            params.delete("search");
        }
        params.set("page", "1"); // Reset to first page
        router.push(`/dashboard?${params.toString()}`);
      }
    }, 500); // 500ms debounce

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
    params.set("page", "1"); // Reset to first page
    router.push(`/dashboard?${params.toString()}`);
  };

  const handleTagClick = (tag: string) => {
    // For server-side filtering, we'll only support one tag at a time
    setSelectedTags([tag]);

    const params = new URLSearchParams(urlSearchParams.toString());
    params.set("tag", tag);
    params.set("page", "1"); // Reset to first page when changing filters
    router.push(`/dashboard?${params.toString()}`);
  };

  const removeTag = (tag: string) => {
    setSelectedTags(selectedTags.filter((t) => t !== tag));

    const params = new URLSearchParams(urlSearchParams.toString());
    params.delete("tag");
    params.set("page", "1"); // Reset to first page when changing filters
    router.push(`/dashboard?${params.toString()}`);
  };

  useEffect(() => {
    // Extract all unique tags from links
    const tags = new Set<string>();
    links.forEach((link) => {
      const linkTags = (link.tags as string[]) || [];
      linkTags.forEach((tag) => tags.add(tag));
    });
    setAllTags(Array.from(tags));
  }, [links]);

  const allSelected = selectedLinkIds.length === links.length && links.length > 0;

  const handleSelectAllToggle = () => {
    if (allSelected) {
      clearSelection();
    } else {
      selectAll(links.map((l) => l.id));
    }
  };

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2">
        {/* Search input */}
        <Input
          className="w-full sm:flex-1"
          placeholder="Search links..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
        />

        {/* Filters */}
        {/* Archived filter */}
        <Select
          onValueChange={handleArchivedFilterChange}
          value={archivedFilter}
        >
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="Show links" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">
              <Archive className="inline-block h-4 w-4 mr-1.5 text-gray-400" />
              Active
            </SelectItem>
            <SelectItem value="archived">
              <ArchiveRestore className="inline-block h-4 w-4 mr-1.5 text-gray-400" />
              Archived
            </SelectItem>
            <SelectItem value="all">
              <GalleryVerticalEnd className="inline-block h-4 w-4 mr-1.5 text-gray-400" />
              All
            </SelectItem>
          </SelectContent>
        </Select>

        {/* Tag filter */}
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
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="Filter by tag" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <Tags className="inline-block h-4 w-4 mr-1.5 text-gray-400" />
              All tags
            </SelectItem>
            {allTags.map((tag) => (
              <SelectItem key={tag} value={tag}>
                <Tag className="inline-block h-4 w-4 mr-1.5 text-gray-400" />
                {tag}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Sort order */}
        <Select
          onValueChange={handleOrderChange}
          value={`${orderBy}-${orderDirection}`}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="createdAt-desc">
              <CalendarDays className="inline-block h-4 w-4 mr-1.5 text-gray-400" />
              Newest first
            </SelectItem>
            <SelectItem value="createdAt-asc">
              <CalendarDays className="inline-block h-4 w-4 mr-1.5 text-gray-400" />
              Oldest first
            </SelectItem>
            <SelectItem value="lastClicked-desc">
              <MousePointerClick className="inline-block h-4 w-4 mr-1.5 text-gray-400" />
              Recently clicked
            </SelectItem>
            <SelectItem value="lastClicked-asc">
              <MousePointerClick className="inline-block h-4 w-4 mr-1.5 text-gray-400" />
              Least recently clicked
            </SelectItem>
            <SelectItem value="totalClicks-desc">
              <ArrowDown className="inline-block h-4 w-4 mr-1.5 text-gray-400" />
              Most clicks
            </SelectItem>
            <SelectItem value="totalClicks-asc">
              <ArrowUp className="inline-block h-4 w-4 mr-1.5 text-gray-400" />
              Least clicks
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-gray-500 my-auto">Filtered by:</span>
          {selectedTags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="flex items-center gap-1 px-2 py-1"
            >
              {tag}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => removeTag(tag)}
              >
                <X size={12} />
              </Button>
            </Badge>
          ))}
          {selectedTags.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs text-gray-500"
              onClick={() => {
                setSelectedTags([]);
                const params = new URLSearchParams(urlSearchParams.toString());
                params.delete("tag");
                params.set("page", "1"); // Reset to first page when clearing filters
                router.push(`/dashboard?${params.toString()}`);
              }}
            >
              Clear all
            </Button>
          )}
        </div>
      )}

      {/* Selection mode bar */}
      <AnimatePresence>
        {isSelectionMode && links.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: "auto", marginTop: 16 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-2.5 border border-gray-100">
              <div className="flex items-center gap-3">
                <motion.button
                  type="button"
                  onClick={handleSelectAllToggle}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                  whileTap={{ scale: 0.98 }}
                >
                  <div className={`flex h-4 w-4 items-center justify-center rounded border-2 transition-colors ${
                    allSelected ? "border-gray-900 bg-gray-900" : "border-gray-300 bg-white"
                  }`}>
                    {allSelected && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                  </div>
                  <span className="font-medium">
                    {allSelected ? "Deselect all" : `Select all (${links.length})`}
                  </span>
                </motion.button>
                {selectedLinkIds.length > 0 && (
                  <span className="text-sm text-gray-400">
                    {selectedLinkIds.length} selected
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={exitSelectionMode}
                className="text-gray-500 hover:text-gray-700 -mr-2"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div className="mt-6 space-y-2 first:mt-0">
        <AnimatePresence>
          {links.map((link, index) => (
            <motion.div
              key={link.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              <Link link={link} onTagClick={handleTagClick} />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      {links.length === 0 && (
        <div className="mt-6 text-center text-gray-500">
          <p>No links found matching your filters.</p>
        </div>
      )}

      {totalPages > 1 && (
        <div className="sticky bottom-2 z-10 mt-6 flex items-center justify-between rounded-md border bg-gray-100 px-4 py-3 shadow-sm">
          <div className="flex items-center">
            <p className="text-sm text-gray-500">
              Page {currentPage} of {totalPages} of {totalLinks} links
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {currentPage > 1 && (
              <Button
                variant="ghost"
                onClick={() => handlePageChange(currentPage - 1)}
              >
                Previous
              </Button>
            )}
            {currentPage < totalPages && (
              <Button
                variant="ghost"
                onClick={() => handlePageChange(currentPage + 1)}
              >
                Next
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Bulk Action Bar */}
      <BulkActionBar />
    </>
  );
};

// Wrapper component that provides the selection context
export const Links = (props: LinksProps) => {
  return (
    <SelectionProvider>
      <LinksContent {...props} />
    </SelectionProvider>
  );
};
