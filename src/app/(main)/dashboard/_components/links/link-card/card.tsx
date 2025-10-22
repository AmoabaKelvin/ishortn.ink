"use client";

import { Copy } from "lucide-react";
import { useTransitionRouter } from "next-view-transitions";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { copyToClipboard, daysSinceDate } from "@/lib/utils";

import { LinkActions } from "./actions";
import { LinkNoteTooltip } from "./note-tooltip";
import { LinkPasswordStatusTooltip } from "./security-tooltip";

import type { RouterOutputs } from "@/trpc/shared";

type LinkProps = {
  link: RouterOutputs["link"]["list"]["links"][number];
  onTagClick?: (tag: string) => void;
};

const Link = ({ link, onTagClick }: LinkProps) => {
  const router = useTransitionRouter();

  const daysSinceLinkCreation = daysSinceDate(new Date(link.createdAt!));
  const tags = (link.tags as string[]) || [];

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
              <LinkStatus disabled={link.disabled ?? false} />
              <LinkPasswordStatusTooltip link={link} />
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
          <p className="text-sm text-gray-500">
            <span>
              {daysSinceLinkCreation === 0
                ? "Today"
                : `${daysSinceLinkCreation}d`}
            </span>
            <span className="mx-1 text-slate-300">•</span>
            <span className="cursor-pointer text-gray-900 break-all hover:underline">
              {link.url}
            </span>
            {tags.length > 0 && (
              <>
                <span className="mx-1 text-slate-300">•</span>
                <span className="flex-wrap inline-flex gap-1">
                  {tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="cursor-pointer bg-gray-50 hover:bg-gray-100 text-xs py-0 h-5"
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
            variant="secondary"
            className="rounded-md bg-slate-200 transition-all duration-500 hover:scale-110 hover:cursor-pointer"
            onClick={() => router.push(`/dashboard/analytics/${link.alias}`)}
          >
            {link.totalClicks}
            <span className="ml-0.5 hidden md:inline">visits</span>
            <span className="ml-0.5 inline md:hidden">v</span>
          </Badge>
          <LinkActions link={link} />
        </div>
      </div>
    </Card>
  );
};
export default Link;

function LinkStatus({ disabled }: { disabled: boolean }) {
  return (
    <div
      className={`flex items-center gap-2 ${
        disabled ? "text-red-500" : "text-blue-500"
      }`}
    >
      {disabled ? (
        <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-red-300" />
      ) : (
        <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-blue-300" />
      )}
    </div>
  );
}
