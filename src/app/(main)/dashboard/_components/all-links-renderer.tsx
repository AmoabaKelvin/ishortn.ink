"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
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

import Link from "./single-link/link-card";

import type { RouterOutputs } from "@/trpc/shared";
type LinksProps = {
  links: RouterOutputs["link"]["list"]["links"];
  totalLinks: number;
  totalPages: number;
  currentPage: number;
};

const Links = (
  { links, totalPages, currentPage, totalLinks }: LinksProps,
  searchParams: Record<string, string | string[] | undefined>
) => {
  const router = useRouter();
  const urlSearchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredLinks, setFilteredLinks] = useState(links);
  const [orderBy, setOrderBy] = useState(
    urlSearchParams.get("orderBy") ?? "createdAt"
  );
  const [orderDirection, setOrderDirection] = useState(
    urlSearchParams.get("orderDirection") ?? "desc"
  );
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);

  // Initialize selectedTags from URL on component mount
  useEffect(() => {
    const tagFromUrl = urlSearchParams.get("tag");
    if (tagFromUrl) {
      setSelectedTags([tagFromUrl]);
    }
  }, [urlSearchParams]);

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

  useEffect(() => {
    let filtered = links;

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter((link) => {
        return (
          link.url!.toLowerCase().includes(searchQuery.toLowerCase()) ||
          link.alias!.toLowerCase().includes(searchQuery.toLowerCase())
        );
      });
    }

    // Filter by selected tags
    if (selectedTags.length > 0) {
      filtered = filtered.filter((link) => {
        const linkTags = (link.tags as string[]) || [];
        return selectedTags.every((tag) => linkTags.includes(tag));
      });
    }

    setFilteredLinks(filtered);
  }, [searchQuery, links, selectedTags]);

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <Input
            className="w-full"
            placeholder="Search links"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          <div className="flex gap-2">
            <Select
              onValueChange={(value) => {
                if (value !== "all") {
                  handleTagClick(value);
                } else {
                  // Clear tag filter
                  setSelectedTags([]);
                  const params = new URLSearchParams(
                    urlSearchParams.toString()
                  );
                  params.delete("tag");
                  params.set("page", "1");
                  router.push(`/dashboard?${params.toString()}`);
                }
              }}
              value={selectedTags.length > 0 ? selectedTags[0] : "all"}
            >
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Filter by tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tags</SelectItem>
                {allTags.map((tag) => (
                  <SelectItem key={tag} value={tag}>
                    {tag}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              onValueChange={handleOrderChange}
              defaultValue={`${orderBy}-${orderDirection}`}
            >
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt-desc">Newest first</SelectItem>
                <SelectItem value="createdAt-asc">Oldest first</SelectItem>
                <SelectItem value="lastClicked-desc">
                  Recently clicked
                </SelectItem>
                <SelectItem value="lastClicked-asc">
                  Least recently clicked
                </SelectItem>
                <SelectItem value="totalClicks-desc">Most clicks</SelectItem>
                <SelectItem value="totalClicks-asc">Least clicks</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
                  const params = new URLSearchParams(
                    urlSearchParams.toString()
                  );
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
      </div>

      <motion.div className="mt-6 space-y-2 first:mt-0">
        <AnimatePresence>
          {filteredLinks.map((link, index) => (
            <motion.div
              key={link.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <Link link={link} onTagClick={handleTagClick} />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      {filteredLinks.length === 0 && (
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
                // className="text-sm text-gray-500 hover:text-gray-700"
              >
                Next
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default Links;
