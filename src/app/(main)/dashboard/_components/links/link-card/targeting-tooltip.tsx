import { IconDeviceMobile, IconWorld } from "@tabler/icons-react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { summarizeTargeting } from "@/lib/core/geo-rules/targeting-summary";

import type { TargetingRuleType } from "@/lib/constants/targeting";

const KIND_ICONS = { device: IconDeviceMobile, location: IconWorld };

export function LinkTargetingTooltip({ types }: { types: TargetingRuleType[] }) {
  const summary = summarizeTargeting(types);
  if (!summary) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {/* A button so keyboard users can reach the tooltip; it has no action of its own. */}
          <button
            type="button"
            aria-label={summary.label}
            className="inline-flex items-center gap-0.5 rounded-md text-neutral-400 hover:text-neutral-600 dark:text-muted-foreground dark:hover:text-neutral-400"
          >
            {summary.kinds.map((kind) => {
              const Icon = KIND_ICONS[kind];
              return <Icon key={kind} size={16} stroke={1.5} aria-hidden />;
            })}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{summary.label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
