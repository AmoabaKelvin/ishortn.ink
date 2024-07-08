import { ShieldBan, ShieldCheckIcon } from "lucide-react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import type { RouterOutputs } from "@/trpc/shared";

type LinkSecurityStatusTooltipProps = {
  link: RouterOutputs["link"]["list"][number];
};

export const LinkSecurityStatusTooltip = ({ link }: LinkSecurityStatusTooltipProps) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {link.passwordHash ? (
            <ShieldCheckIcon className="mr-2 size-4" />
          ) : (
            <ShieldBan className="mr-2 size-4" />
          )}
        </TooltipTrigger>
        <TooltipContent>
          {link.passwordHash ? "Password Protected" : "Not Password Protected"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
