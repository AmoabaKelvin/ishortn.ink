"use client";

import { useRangeTransition } from "@/app/(main)/dashboard/analytics/_components/range-transition";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SharedRangeSelectProps = {
  options: readonly { value: string; label: string }[];
};

/** The presets the owner's plan allows; changing one reloads the page with ?range=. */
export function SharedRangeSelect({ options }: SharedRangeSelectProps) {
  const { range, setRange } = useRangeTransition();

  return (
    <Select value={range} onValueChange={(value) => setRange(value)}>
      <SelectTrigger
        aria-label="Date range"
        className="h-9 w-full border-neutral-200 bg-white text-[13px] dark:border-border dark:bg-card sm:w-[180px]"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} className="text-[13px]">
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
