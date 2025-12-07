import { NotebookText } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";

type LinkNoteViewerProps = {
  note: string;
};

export function LinkNoteTooltip({ note }: LinkNoteViewerProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <NotebookText className="h-4 w-4 text-slate-500 hover:cursor-pointer" />
        </TooltipTrigger>
        <TooltipContent>
          <p>{note}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
