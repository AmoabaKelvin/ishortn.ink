"use client";

import { Link as LinkIcon } from "lucide-react";

import Link from "@/app/(main)/dashboard/_components/links/link-card/card";
import { SelectionProvider } from "@/app/(main)/dashboard/_components/links/selection-context";

import type { RouterOutputs } from "@/trpc/shared";

type FolderLinksProps = {
  links: RouterOutputs["folder"]["get"]["links"];
  folderId: number;
};

export function FolderLinks({ links, folderId }: FolderLinksProps) {
  if (links.length === 0) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed bg-slate-50/50 p-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <LinkIcon className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-gray-900">
          No links in this folder yet
        </h3>
        <p className="mt-2 text-sm text-gray-500">
          Move links to this folder from your dashboard to organize them.
        </p>
      </div>
    );
  }

  return (
    <SelectionProvider>
      <div className="space-y-4">
        {links.map((link) => (
          <Link key={link.id} link={link} />
        ))}
      </div>
    </SelectionProvider>
  );
}

