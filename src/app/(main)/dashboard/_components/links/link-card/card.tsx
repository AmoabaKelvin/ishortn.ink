"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  IconCheck,
  IconCopy,
  IconEye,
  IconFolder,
  IconClick,
} from "@tabler/icons-react";
import { useTransitionRouter } from "next-view-transitions";

import { cn, copyToClipboard, daysSinceDate } from "@/lib/utils";

import { useSelection } from "../selection-context";
import { LinkActions } from "./actions";
import { LinkNoteTooltip } from "./note-tooltip";

import type { RouterOutputs } from "@/trpc/shared";

type LinkProps = {
  link: RouterOutputs["link"]["list"]["links"][number];
  onTagClick?: (tag: string) => void;
};

const Link = ({ link, onTagClick }: LinkProps) => {
  const router = useTransitionRouter();
  const { isSelectionMode, isSelected, toggleSelection } = useSelection();
  const selected = isSelected(link.id);

  const daysSinceLinkCreation = daysSinceDate(new Date(link.createdAt!));
  const tags = (link.tags as string[]) || [];
  const folderInfo = link.folder as { id: number; name: string } | null;
  const createdBy = link.createdBy as {
    id: string;
    name: string | null;
    imageUrl: string | null;
  } | null;

  const handleCardClick = (e: React.MouseEvent) => {
    if (isSelectionMode) {
      e.preventDefault();
      toggleSelection(link.id);
    }
  };

  return (
    <div
      className={cn(
        "group relative px-1 py-4 transition-colors",
        isSelectionMode && "cursor-pointer",
        selected && "bg-neutral-50",
      )}
      onClick={handleCardClick}
    >
      <div className="flex items-center gap-3">
        {/* Checkbox */}
        <div
          className={cn(
            "flex shrink-0 items-center transition-all duration-150",
            isSelectionMode
              ? "w-5 opacity-100"
              : "w-0 overflow-hidden opacity-0 group-hover:w-5 group-hover:opacity-100",
          )}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleSelection(link.id);
            }}
            className={cn(
              "flex h-[18px] w-[18px] items-center justify-center rounded border-[1.5px] transition-colors",
              selected
                ? "border-blue-600 bg-blue-600"
                : "border-neutral-300 bg-white hover:border-neutral-400",
            )}
          >
            <AnimatePresence mode="wait">
              {selected && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ duration: 0.1 }}
                >
                  <IconCheck size={11} stroke={3} className="text-white" />
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Title row */}
          <div className="flex items-center gap-2">
            <span
              className="cursor-pointer truncate text-[14px] font-medium text-neutral-900 transition-colors hover:text-neutral-600"
              onClick={(e) => {
                if (!isSelectionMode) {
                  e.stopPropagation();
                  router.push(
                    `/dashboard/analytics/${link.alias}?domain=${link.domain}`,
                  );
                }
              }}
            >
              {link.name !== "Untitled Link" && link.name
                ? link.name
                : `${link.domain}/${link.alias}`}
            </span>
            <button
              type="button"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
              onClick={async (e) => {
                e.stopPropagation();
                await copyToClipboard(`https://${link.domain}/${link.alias}`);
              }}
            >
              <IconCopy size={14} stroke={1.5} />
            </button>
          </div>

          {/* Metadata row */}
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px]">
            <span className="text-neutral-400">
              {daysSinceLinkCreation === 0
                ? "Today"
                : `${daysSinceLinkCreation}d`}
            </span>
            <span className="text-neutral-300">&middot;</span>
            <span
              className="max-w-[200px] cursor-pointer truncate text-neutral-500 underline-offset-2 transition-colors hover:text-neutral-900 hover:underline sm:max-w-[300px]"
              onClick={(e) => {
                if (!isSelectionMode) {
                  e.stopPropagation();
                  window.open(link.url ?? "", "_blank");
                }
              }}
            >
              {link.url && link.url.length > 50
                ? `${link.url.substring(0, 50)}...`
                : link.url}
            </span>

            {folderInfo && (
              <>
                <span className="text-neutral-300">&middot;</span>
                <button
                  className="inline-flex items-center gap-1 rounded-md text-neutral-500 transition-colors hover:text-neutral-900"
                  onClick={(e) => {
                    if (!isSelectionMode) {
                      e.stopPropagation();
                      router.push(`/dashboard/folders/${folderInfo.id}`);
                    }
                  }}
                >
                  <IconFolder size={12} stroke={1.5} />
                  <span>{folderInfo.name}</span>
                </button>
              </>
            )}

            {tags.length > 0 && (
              <>
                <span className="text-neutral-300">&middot;</span>
                <span className="inline-flex flex-wrap gap-1">
                  {tags.map((tag) => (
                    <button
                      key={tag}
                      className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] font-medium text-neutral-500 transition-colors hover:bg-neutral-200 hover:text-neutral-700"
                      onClick={(e) => {
                        if (!isSelectionMode) {
                          e.stopPropagation();
                          onTagClick?.(tag);
                        }
                      }}
                    >
                      {tag}
                    </button>
                  ))}
                </span>
              </>
            )}

            {createdBy && (
              <>
                <span className="text-neutral-300">&middot;</span>
                <span className="inline-flex items-center gap-1 text-neutral-400">
                  {createdBy.imageUrl ? (
                    <img
                      src={createdBy.imageUrl}
                      alt={createdBy.name ?? "User"}
                      className="h-3.5 w-3.5 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-neutral-200 text-[9px] font-medium text-neutral-600">
                      {(createdBy.name ?? "U").charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="max-w-[80px] truncate text-[11px]">
                    {createdBy.name ?? "Unknown"}
                  </span>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right actions */}
        <div className="flex shrink-0 items-center gap-2">
          {link.note && <LinkNoteTooltip note={link.note} />}

          {link.cloaking && (
            <span
              className="inline-flex items-center gap-1 rounded-md border border-neutral-200 px-2 py-1 text-[11px] font-medium text-neutral-500"
              title="Link cloaking enabled"
            >
              <IconEye size={12} stroke={1.5} />
              Cloaked
            </span>
          )}

          <button
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] tabular-nums text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            onClick={(e) => {
              if (!isSelectionMode) {
                e.stopPropagation();
                router.push(
                  `/dashboard/analytics/${link.alias}?domain=${link.domain}`,
                );
              }
            }}
          >
            <IconClick size={14} stroke={1.5} />
            <span className="font-medium">{link.totalClicks}</span>
          </button>

          {!isSelectionMode && <LinkActions link={link} />}
        </div>
      </div>
    </div>
  );
};
export default Link;
