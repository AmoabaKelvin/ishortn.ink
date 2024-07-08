"use client";

import { Copy } from "lucide-react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { copyToClipboard, daysSinceDate } from "@/lib/utils";

import { LinkActions } from "./link-actions";
import { LinkSecurityStatusTooltip } from "./link-security-status-tooltip";

import type { RouterOutputs } from "@/trpc/shared";
type LinkProps = {
  link: RouterOutputs["link"]["list"][number];
};

const Link = ({ link }: LinkProps) => {
  const router = useRouter();

  const daysSinceLinkCreation = daysSinceDate(new Date(link.createdAt!));

  return (
    <div className="flex items-center justify-between rounded-md bg-gray-100 px-6 py-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div
            className="flex cursor-pointer items-center text-blue-600 hover:underline"
            onClick={() => router.push(`/dashboard/analytics/${link.alias}`)}
          >
            <LinkStatus disabled={link.disabled!} />
            <LinkSecurityStatusTooltip link={link} />
            ishortn.ink/{link.alias}
          </div>
          <div
            className="hover:animate-wiggle-more flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-white "
            onClick={async () => {
              await copyToClipboard(`https://ishortn.ink/${link.alias}`);
            }}
          >
            <Copy className="h-3 w-3" />
          </div>
        </div>
        <p className="text-sm text-gray-500">
          <span>{daysSinceLinkCreation === 0 ? "Today" : `${daysSinceLinkCreation}d`}</span>
          <span className="mx-1 text-slate-300">•</span>
          <span className="cursor-pointer text-gray-900 hover:underline">{link.url}</span>
        </p>
      </div>
      <div className="flex items-center gap-2">
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
  );
};
export default Link;

function LinkStatus({ disabled }: { disabled: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${disabled ? "text-red-500" : "text-blue-500"}`}>
      {disabled ? (
        <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-red-300"></span>
      ) : (
        <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-blue-300"></span>
      )}
    </div>
  );
}
