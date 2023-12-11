"use client";

import { useState } from "react";

import React from "react";

import { Input } from "@/components/ui/input";
import { Prisma } from "@prisma/client";
import LinkShowcase from "./dynamic-link-showcase";

type Link = Prisma.DynamicLinkGetPayload<{
  include: {
    childLinks: true;
  };
}>;

const DynamicLinksView = ({ links }: { links: Link[] }) => {
  const [search, setSearch] = useState("");

  const filteredLinks = links.filter((link) =>
    link.childLinks.some((childLink) =>
      childLink.shortLink.toLowerCase().includes(search.toLowerCase()),
    ),
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
      <div className="flex flex-col gap-5 mt-6">
        {filteredLinks.map((link) => (
          <LinkShowcase key={link.id} link={link} />
        ))}
      </div>
    </main>
  );
};

export default DynamicLinksView;
