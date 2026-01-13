"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Eye, Folder, MousePointerClick } from "lucide-react";
import { useTransitionRouter } from "next-view-transitions";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
    <motion.div
      layout
      initial={false}
      animate={{
        scale: selected ? 0.995 : 1,
      }}
      transition={{ duration: 0.15, ease: "easeOut" }}
    >
      <Card
        className={cn(
          "group relative flex flex-col rounded-xl border px-5 py-4 transition-all duration-200",
          // Default state
          "bg-white border-gray-100 hover:border-gray-200",
          // Selection mode states
          isSelectionMode && "cursor-pointer",
          isSelectionMode && !selected && "hover:bg-gray-50/50",
          // Selected state - subtle and refined
          selected &&
            "bg-gradient-to-r from-blue-50/80 to-indigo-50/50 border-blue-200/60 shadow-sm shadow-blue-100/50",
        )}
        onClick={handleCardClick}
      >
        {/* Selection Indicator - Left edge accent */}
        <AnimatePresence>
          {selected && (
            <motion.div
              initial={{ scaleY: 0, opacity: 0 }}
              animate={{ scaleY: 1, opacity: 1 }}
              exit={{ scaleY: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="absolute left-0 top-3 bottom-3 w-1 bg-blue-500 rounded-r-full origin-center"
            />
          )}
        </AnimatePresence>

        <div className="flex items-center justify-between w-full">
          {/* Checkbox - Shows on hover or in selection mode */}
          <div
            className={cn(
              "flex items-center transition-all duration-200",
              isSelectionMode
                ? "w-8 mr-2"
                : "w-0 mr-0 overflow-hidden opacity-0 group-hover:w-8 group-hover:mr-2 group-hover:opacity-100",
            )}
          >
            <motion.button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleSelection(link.id);
              }}
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-md border-2 transition-all duration-150",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:ring-offset-1",
                selected
                  ? "border-blue-500 bg-blue-500"
                  : "border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50",
              )}
              whileTap={{ scale: 0.9 }}
            >
              <AnimatePresence mode="wait">
                {selected && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ duration: 0.1 }}
                  >
                    <Check className="h-3 w-3 text-white" strokeWidth={3} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          </div>

          {/* Main content */}
          <div className="flex-1 flex flex-col gap-2 min-w-0">
            <div className="flex items-center gap-2">
              <div
                className="flex cursor-pointer items-center text-gray-900 font-medium hover:text-blue-600 transition-colors truncate"
                onClick={(e) => {
                  if (!isSelectionMode) {
                    e.stopPropagation();
                    router.push(`/dashboard/analytics/${link.alias}?domain=${link.domain}`);
                  }
                }}
              >
                {link.name !== "Untitled Link" && link.name ? (
                  <span className="truncate">{link.name}</span>
                ) : (
                  <span className="truncate">
                    {link.domain}/{link.alias}
                  </span>
                )}
              </div>
              <motion.button
                type="button"
                className="flex h-7 w-7 flex-shrink-0 cursor-pointer items-center justify-center rounded-lg bg-gray-100/80 hover:bg-gray-200/80 transition-colors"
                onClick={async (e) => {
                  e.stopPropagation();
                  await copyToClipboard(`https://${link.domain}/${link.alias}`);
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Copy className="h-3.5 w-3.5 text-gray-500" />
              </motion.button>
            </div>
            <p className="text-sm text-gray-500 flex items-center gap-1.5 flex-wrap">
              <span className="text-gray-400">
                {daysSinceLinkCreation === 0 ? "Today" : `${daysSinceLinkCreation}d`}
              </span>
              <span className="text-gray-300">·</span>
              <span
                className="cursor-pointer text-gray-600 hover:text-gray-900 hover:underline underline-offset-2 truncate max-w-[200px] sm:max-w-[300px]"
                onClick={(e) => {
                  if (!isSelectionMode) {
                    e.stopPropagation();
                    window.open(link.url ?? "", "_blank");
                  }
                }}
              >
                {link.url && link.url.length > 50 ? `${link.url.substring(0, 50)}...` : link.url}
              </span>
              {folderInfo && (
                <>
                  <span className="text-gray-300">·</span>
                  <Badge
                    variant="outline"
                    className="cursor-pointer rounded-lg py-1.5 px-2.5 bg-gray-50 border-gray-200 hover:bg-gray-100 transition-colors"
                    onClick={(e) => {
                      if (!isSelectionMode) {
                        e.stopPropagation();
                        router.push(`/dashboard/folders/${folderInfo.id}`);
                      }
                    }}
                  >
                    <Folder className="h-3.5 w-3.5 mr-1.5 text-amber-500" />
                    <span className="text-gray-700 font-medium text-xs">{folderInfo.name}</span>
                  </Badge>
                </>
              )}
              {tags.length > 0 && (
                <>
                  <span className="text-gray-300">·</span>
                  <span className="inline-flex gap-1 flex-wrap">
                    {tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className="cursor-pointer rounded-md bg-gray-50 hover:bg-gray-100 text-xs py-0 h-5 border-gray-200 text-gray-600"
                        onClick={(e) => {
                          if (!isSelectionMode) {
                            e.stopPropagation();
                            onTagClick && onTagClick(tag);
                          }
                        }}
                      >
                        {tag}
                      </Badge>
                    ))}
                  </span>
                </>
              )}
              {createdBy && (
                <>
                  <span className="text-gray-300">·</span>
                  <span className="inline-flex items-center gap-1.5 text-gray-500">
                    {createdBy.imageUrl ? (
                      <img
                        src={createdBy.imageUrl}
                        alt={createdBy.name ?? "User"}
                        className="h-4 w-4 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-gray-200 text-[10px] font-medium text-gray-600">
                        {(createdBy.name ?? "U").charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="text-xs text-gray-500 max-w-[100px] truncate">
                      {createdBy.name ?? "Unknown"}
                    </span>
                  </span>
                </>
              )}
            </p>
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-2 ml-4 flex-shrink-0">
            {link.note && <LinkNoteTooltip note={link.note} />}
            {link.cloaking && (
              <Badge
                variant="outline"
                className="rounded-lg py-1.5 px-2.5 bg-violet-50 border-violet-200 cursor-default font-normal"
                title="Link cloaking enabled - URL stays in address bar"
              >
                <Eye className="h-3.5 w-3.5 mr-1.5 text-violet-500" />
                <span className="text-violet-700 font-medium text-xs">Cloaked</span>
              </Badge>
            )}
            <Badge
              variant="outline"
              className="rounded-lg py-1.5 px-2.5 bg-gray-50 border-gray-200 cursor-pointer font-normal hover:bg-gray-100 transition-colors"
              onClick={(e) => {
                if (!isSelectionMode) {
                  e.stopPropagation();
                  router.push(`/dashboard/analytics/${link.alias}?domain=${link.domain}`);
                }
              }}
            >
              <MousePointerClick className="h-3.5 w-3.5 mr-1.5 text-blue-500" />
              <span className="text-gray-700 font-medium">{link.totalClicks}</span>
              <span className="ml-1 text-gray-400 hidden md:inline text-xs">clicks</span>
            </Badge>
            {!isSelectionMode && <LinkActions link={link} />}
          </div>
        </div>
      </Card>
    </motion.div>
  );
};
export default Link;
