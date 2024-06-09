"use client";

import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";

import Link from "./link";

import type { RouterOutputs } from "@/trpc/shared";
type LinksProps = {
  links: RouterOutputs["link"]["list"];
};

const Links = ({ links }: LinksProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredLinks, setFilteredLinks] = useState(links);

  useEffect(() => {
    if (!searchQuery) {
      setFilteredLinks(links);
    } else {
      const filtered = links.filter((link) => {
        return link.url!.toLowerCase().includes(searchQuery.toLowerCase());
      });
      setFilteredLinks(filtered);
    }
  }, [searchQuery, links]);

  return (
    <>
      <Input
        className="w-full"
        placeholder="Search links"
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
      />

      <div className="mt-6 space-y-2 first:mt-0">
        {filteredLinks.map((link) => (
          <Link key={link.id} link={link} />
        ))}
      </div>
    </>
  );
};

export default Links;
