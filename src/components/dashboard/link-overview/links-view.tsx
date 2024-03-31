"use client";

import { Prisma } from "@prisma/client";
import React, { useState } from "react";

import { Input } from "@/components/ui/input";

import { ScrollArea } from "@/components/ui/scroll-area";
import LinkShowcase from "./link-showcase";

type Link = Prisma.LinkGetPayload<{
  include: {
    linkVisits: true;
  };
}>;

const LinksView = ({ links }: { links: Link[] }) => {
  const [search, setSearch] = useState("");

  const filteredLinks = links.filter((link) =>
    link.alias.toLowerCase().includes(search.toLowerCase()),
  );

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  };

  return (
    <main>
      <Input
        type="text"
        placeholder="Search for a link"
        value={search}
        onChange={(e) => handleSearch(e)}
      />
      <ScrollArea className="flex flex-col gap-5 mt-6 w-fit h-[30rem]">
        {filteredLinks.map((link) => (
          <LinkShowcase key={link.id} link={link} />
        ))}
      </ScrollArea>
    </main>
  );
};

export default LinksView;
