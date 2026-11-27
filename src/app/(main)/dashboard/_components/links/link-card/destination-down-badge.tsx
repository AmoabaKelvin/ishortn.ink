import { IconAlertTriangle } from "@tabler/icons-react";
import { formatDistanceToNow } from "date-fns";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { describeLinkHealth } from "@/lib/link-health";
import { cn } from "@/lib/utils";

import type { DestinationDown } from "@/server/lib/link-health/status";

/** "404 Not Found · checked 3 hours ago" */
export function destinationDownDetail(down: DestinationDown): string {
  const checked = formatDistanceToNow(new Date(down.lastCheckedAt), { addSuffix: true });
  return `${describeLinkHealth(down.lastStatus, down.lastError)} · checked ${checked}`;
}

const chip =
  "inline-flex shrink-0 items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-[11px] font-medium text-red-600 dark:border-red-500/30 dark:text-red-400";

/** The link-row badge; the status and check time are in its tooltip and accessible name. */
export function DestinationDownBadge({ down }: { down: DestinationDown }) {
  const detail = destinationDownDetail(down);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {/* A button so keyboard users can reach the tooltip; it has no action of its own. */}
          <button type="button" aria-label={`Destination down: ${detail}`} className={chip}>
            <IconAlertTriangle size={12} stroke={1.5} aria-hidden />
            <span className="sm:hidden">Down</span>
            <span className="hidden sm:inline">Destination down</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{detail}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** The link detail page's line: badge plus the status and check time in plain text. */
export function DestinationDownNotice({
  down,
  className,
}: {
  down: DestinationDown;
  className?: string;
}) {
  return (
    <p className={cn("flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1", className)}>
      <span className={chip}>
        <IconAlertTriangle size={12} stroke={1.5} aria-hidden />
        Destination down
      </span>
      <span className="text-[12px] text-neutral-500 dark:text-neutral-400">
        {destinationDownDetail(down)}
      </span>
    </p>
  );
}
