"use client";

import { Copy, Folder, MousePointerClick } from "lucide-react";
import { useTransitionRouter } from "next-view-transitions";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { copyToClipboard, daysSinceDate } from "@/lib/utils";

import { LinkActions } from "./actions";
import { LinkNoteTooltip } from "./note-tooltip";

import type { RouterOutputs } from "@/trpc/shared";

type LinkProps = {
  link: RouterOutputs["link"]["list"]["links"][number];
  onTagClick?: (tag: string) => void;
};

const Link = ({ link, onTagClick }: LinkProps) => {
  const router = useTransitionRouter();

  const daysSinceLinkCreation = daysSinceDate(new Date(link.createdAt!));
  const tags = (link.tags as string[]) || [];
  const folderInfo = link.folder as { id: number; name: string } | null;

  return (
    <Card className="flex flex-col rounded-md px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div
              className="flex cursor-pointer items-center text-blue-600 hover:underline"
              onClick={() =>
                router.push(
                  `/dashboard/analytics/${link.alias}?domain=${link.domain}`
                )
              }
            >
              {link.name !== "Untitled Link" && link.name ? (
                <span className="">{link.name}</span>
              ) : (
                <>
                  {link.domain}/{link.alias}
                </>
              )}
            </div>
            <div
              className="hover:animate-wiggle-more flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-white "
              onClick={async () => {
                await copyToClipboard(`https://${link.domain}/${link.alias}`);
              }}
            >
              <Copy className="h-3 w-3" />
            </div>
          </div>
          <p className="text-sm text-gray-500 flex items-center gap-1 flex-wrap">
            <span>
              {daysSinceLinkCreation === 0
                ? "Today"
                : `${daysSinceLinkCreation}d`}
            </span>
            <span className="text-slate-300">•</span>
            <span className="cursor-pointer text-gray-900 hover:underline">
              {link.url && link.url.length > 50
                ? `${link.url.substring(0, 50)}...`
                : link.url}
            </span>
            {folderInfo && (
              <>
                <span className="text-slate-300">•</span>
                <Badge
                  variant="outline"
                  className="cursor-pointer rounded-md bg-slate-50 hover:bg-slate-100 text-xs py-0 h-5"
                  onClick={() =>
                    router.push(`/dashboard/folders/${folderInfo.id}`)
                  }
                >
                  <Folder className="h-3 w-3 mr-1" />
                  {folderInfo.name}
                </Badge>
              </>
            )}
            {tags.length > 0 && (
              <>
                <span className="text-slate-300">•</span>
                <span className="inline-flex gap-1">
                  {tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="cursor-pointer rounded-md bg-slate-50 hover:bg-slate-100 text-xs py-0 h-5"
                      onClick={() => onTagClick && onTagClick(tag)}
                    >
                      {tag}
                    </Badge>
                  ))}
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {link.note && <LinkNoteTooltip note={link.note} />}
          <Badge
            variant="outline"
            className="rounded-md py-1 bg-slate-50 cursor-pointer font-normal"
            onClick={() => router.push(`/dashboard/analytics/${link.alias}`)}
          >
            <MousePointerClick className="h-4 w-4 mr-1 text-blue-600" />
            {link.totalClicks}
            <span className="ml-1 hidden md:inline">visits</span>
            <span className="ml-1 inline md:hidden">v</span>
          </Badge>
          <LinkActions link={link} />
        </div>
      </div>
    </Card>
  );
};
export default Link;
