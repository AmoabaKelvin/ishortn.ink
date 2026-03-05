import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { IconSparkles } from "@tabler/icons-react";

function UpgradeToProAIButtonTooltip() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
          <div className="cursor-pointer">
            <IconSparkles size={16} stroke={1.5} className="text-neutral-400" />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Upgrade to Pro to use AI features.</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default UpgradeToProAIButtonTooltip;
