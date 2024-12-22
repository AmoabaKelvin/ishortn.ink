"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
  searchParams: Record<string, string | string[] | undefined>,
) => {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredLinks, setFilteredLinks] = useState(links);
  const [orderBy, setOrderBy] = useState((searchParams.orderBy as string) ?? "createdAt");
  const [orderDirection, setOrderDirection] = useState(
    (searchParams.orderDirection as string) ?? "desc",
  );

  const handlePageChange = (page: number) => {
    router.push(`/dashboard?page=${page}&orderBy=${orderBy}&orderDirection=${orderDirection}`);
  };

  const handleOrderChange = (value: string) => {
    const [newOrderBy, newOrderDirection] = value.split("-");
    setOrderBy(newOrderBy!);
    setOrderDirection(newOrderDirection!);
    router.push(
      `/dashboard?page=${currentPage}&orderBy=${newOrderBy}&orderDirection=${newOrderDirection}`,
    );
  };

  useEffect(() => {
    if (!searchQuery) {
      setFilteredLinks(links);
    } else {
      const filtered = links.filter((link) => {
        return (
          link.url!.toLowerCase().includes(searchQuery.toLowerCase()) ||
          link.alias!.toLowerCase().includes(searchQuery.toLowerCase())
        );
      });
      setFilteredLinks(filtered);
    }
  }, [searchQuery, links]);

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <Input
          className="w-full"
          placeholder="Search links"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
        />
        <Select onValueChange={handleOrderChange} defaultValue={`${orderBy}-${orderDirection}`}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="createdAt-desc">Newest first</SelectItem>
            <SelectItem value="createdAt-asc">Oldest first</SelectItem>
            <SelectItem value="lastClicked-desc">Recently clicked</SelectItem>
            <SelectItem value="lastClicked-asc">Least recently clicked</SelectItem>
            <SelectItem value="totalClicks-desc">Most clicks</SelectItem>
            <SelectItem value="totalClicks-asc">Least clicks</SelectItem>
          </SelectContent>
        </Select>
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
              <Link link={link} />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      {totalPages > 1 && (
        <div className="sticky bottom-2 z-10 mt-6 flex items-center justify-between rounded-md border bg-gray-100 px-4 py-3 shadow-sm">
          <div className="flex items-center">
            <p className="text-sm text-gray-500">
              Page {currentPage} of {totalPages} of {totalLinks} links
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {currentPage > 1 && (
              <Button variant="ghost" onClick={() => handlePageChange(currentPage - 1)}>
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
