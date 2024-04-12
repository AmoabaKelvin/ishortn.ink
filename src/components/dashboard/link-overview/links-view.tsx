"use client";

import { Prisma } from "@prisma/client";
import React, { useState } from "react";

import { Input } from "@/components/ui/input";

import DashboardEmptyState from "../empty-state";
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
    <main className="h-full">
      <Input
        type="text"
        placeholder="Search for a link"
        value={search}
        onChange={(e) => handleSearch(e)}
      />
      {links.length === 0 ? (
        <DashboardEmptyState />
      ) : (
        <div className="flex flex-col gap-5 mt-6">
          {filteredLinks.map((link) => (
            <LinkShowcase key={link.id} link={link} />
          ))}
        </div>
      )}
    </main>
  );
};

export default LinksView;
