"use client";

import { motion } from "framer-motion";
import {
  IconClick,
  IconLock,
  IconPencil,
  IconSettings,
  IconTrash,
} from "@tabler/icons-react";
import { useTransitionRouter } from "next-view-transitions";

import { daysSinceDate } from "@/lib/utils";

import type { RouterOutputs } from "@/trpc/shared";

type FolderCardProps = {
  folder: RouterOutputs["folder"]["list"][number];
  index: number;
  onEdit: (folder: RouterOutputs["folder"]["list"][number]) => void;
  onDelete: (folder: RouterOutputs["folder"]["list"][number]) => void;
  onSettings?: (folder: RouterOutputs["folder"]["list"][number]) => void;
  showSettingsButton?: boolean;
};

export function FolderCard({
  folder,
  index,
  onEdit,
  onDelete,
  onSettings,
  showSettingsButton = false,
}: FolderCardProps) {
  const router = useTransitionRouter();

  const handleCardClick = () => {
    router.push(`/dashboard/folders/${folder.id}`);
  };

  const daysSinceFolderCreation = daysSinceDate(folder.createdAt ?? new Date());
  const hasRestrictions = folder.hasRestrictions ?? false;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.2, delay: index * 0.04 }}
    >
      <div
        className="group relative cursor-pointer px-1 py-4 transition-colors"
        onClick={handleCardClick}
      >
        <div className="flex items-center gap-3">
          {/* Content */}
          <div className="min-w-0 flex-1">
            {/* Title row */}
            <div className="flex items-center gap-2">
              <span className="truncate text-[14px] font-medium text-neutral-900 dark:text-foreground transition-colors group-hover:text-neutral-600">
                {folder.name}
              </span>
              {hasRestrictions && (
                <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">
                  <IconLock size={10} stroke={2} />
                  Restricted
                </span>
              )}
            </div>

            {/* Metadata row */}
            <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px]">
              <span className="text-neutral-400 dark:text-neutral-500">
                {daysSinceFolderCreation === 0
                  ? "Today"
                  : `${daysSinceFolderCreation}d`}
              </span>
              <span className="text-neutral-300">&middot;</span>
              <span className="text-neutral-500 dark:text-neutral-400">
                {folder.linkCount} {folder.linkCount === 1 ? "link" : "links"}
              </span>
              {folder.description && (
                <>
                  <span className="text-neutral-300">&middot;</span>
                  <span className="max-w-[250px] truncate text-neutral-400 dark:text-neutral-500">
                    {folder.description}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Right actions */}
          <div className="flex shrink-0 items-center gap-2">
            <button
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] tabular-nums text-neutral-500 dark:text-neutral-400 transition-colors hover:bg-neutral-100 dark:hover:bg-accent hover:text-neutral-900"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/dashboard/folders/${folder.id}`);
              }}
            >
              <IconClick size={14} stroke={1.5} />
              <span className="font-medium">{folder.linkCount}</span>
            </button>

            <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              {showSettingsButton && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSettings?.(folder);
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 dark:text-neutral-500 transition-colors hover:bg-neutral-100 dark:hover:bg-accent hover:text-neutral-600"
                >
                  <IconSettings size={14} stroke={1.5} />
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(folder);
                }}
                className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 dark:text-neutral-500 transition-colors hover:bg-neutral-100 dark:hover:bg-accent hover:text-neutral-600"
              >
                <IconPencil size={14} stroke={1.5} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(folder);
                }}
                className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 dark:text-neutral-500 transition-colors hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600"
              >
                <IconTrash size={14} stroke={1.5} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
