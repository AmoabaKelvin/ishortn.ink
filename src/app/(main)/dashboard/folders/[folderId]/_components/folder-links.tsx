"use client";

import { AnimatePresence, motion } from "framer-motion";
import { IconLink } from "@tabler/icons-react";

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
      <div className="flex flex-col items-center justify-center py-20">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100">
          <IconLink size={20} stroke={1.5} className="text-neutral-400" />
        </div>
        <p className="mt-4 text-[14px] font-medium text-neutral-900">
          No links in this folder
        </p>
        <p className="mt-1 text-[13px] text-neutral-400">
          Move links here from your dashboard to organize them.
        </p>
      </div>
    );
  }

  return (
    <SelectionProvider>
      <div className="divide-y divide-neutral-300/60">
        <AnimatePresence>
          {links.map((link, index) => (
            <motion.div
              key={link.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2, delay: index * 0.03 }}
            >
              <Link link={link} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </SelectionProvider>
  );
}
