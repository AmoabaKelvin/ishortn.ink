import { IconNote } from "@tabler/icons-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type LinkNoteViewerProps = {
  note: string;
};

export function LinkNoteTooltip({ note }: LinkNoteViewerProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <IconNote
            size={16}
            stroke={1.5}
            className="cursor-pointer text-neutral-400 hover:text-neutral-600"
          />
        </TooltipTrigger>
        <TooltipContent>
          <p>{note}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
