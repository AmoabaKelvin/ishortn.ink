import { IconShield, IconShieldCheck } from "@tabler/icons-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import type { RouterOutputs } from "@/trpc/shared";

type LinkSecurityStatusTooltipProps = {
  link: RouterOutputs["link"]["list"]["links"][number];
};

export const LinkPasswordStatusTooltip = ({
  link,
}: LinkSecurityStatusTooltipProps) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {link.passwordHash ? (
            <IconShieldCheck size={16} stroke={1.5} className="mr-2" />
          ) : (
            <IconShield size={16} stroke={1.5} className="mr-2" />
          )}
        </TooltipTrigger>
        <TooltipContent>
          {link.passwordHash ? "Password Protected" : "Not Password Protected"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
