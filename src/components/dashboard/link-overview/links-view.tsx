"use client";

import { useState } from "react";

import React from "react";

import { Input } from "@/components/ui/input";
import { Prisma } from "@prisma/client";
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

  return (
    <main>
      <Input
        type="text"
        placeholder="Search for a link by alias"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
        }}
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
