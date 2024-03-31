"use client";

import { Prisma } from "@prisma/client";
import React, { useState } from "react";

import { Input } from "@/components/ui/input";

import LinkShowcase from "./link-showcase";

type Link = Prisma.LinkGetPayload<{
  include: {
    linkVisits: true;
  };
}>;

const LinksView = ({ links }: { links: Link[] }) => {
  const [search, setSearch] = useState("");

  const filteredLinks = links.filter(
    (link) =>
      link.alias.toLowerCase().includes(search.toLowerCase()) ||
      link.url.toLocaleLowerCase().includes(search.toLowerCase()),
    // sort by date
    // link.createdAt.getFullYear().toString().includes(search.toLowerCase())
  );

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  };

  return (
    <main>
      <Input
        type="text"
        placeholder="Search for a link by alias, date or by url"
        value={search}
        onChange={(e) => handleSearch(e)}
      />
      <div className="flex flex-col gap-5 mt-6">
        {filteredLinks.map((link) => (
          <LinkShowcase key={link.id} link={link} />
        ))}
      </div>
    </main>
  );
};

export default LinksView;
