"use client";

import { IconCalendar } from "@tabler/icons-react";
import { format } from "date-fns";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import type { DateRange } from "react-day-picker";

type Preset = {
  label: string;
  getValue: () => { from: Date; to: Date };
};

const presets: Preset[] = [
  {
    label: "7d",
    getValue: () => {
      const to = new Date();
      to.setHours(23, 59, 59, 999);
      const from = new Date();
      from.setDate(from.getDate() - 6);
      from.setHours(0, 0, 0, 0);
      return { from, to };
    },
  },
  {
    label: "30d",
    getValue: () => {
      const to = new Date();
      to.setHours(23, 59, 59, 999);
      const from = new Date();
      from.setDate(from.getDate() - 29);
      from.setHours(0, 0, 0, 0);
      return { from, to };
    },
  },
  {
    label: "90d",
    getValue: () => {
      const to = new Date();
      to.setHours(23, 59, 59, 999);
      const from = new Date();
      from.setDate(from.getDate() - 89);
      from.setHours(0, 0, 0, 0);
      return { from, to };
    },
  },
  {
    label: "1 Year",
    getValue: () => {
      const to = new Date();
      to.setHours(23, 59, 59, 999);
      const from = new Date();
      from.setFullYear(from.getFullYear() - 1);
      from.setHours(0, 0, 0, 0);
      return { from, to };
    },
  },
  {
    label: "All Time",
    getValue: () => {
      const to = new Date();
      to.setHours(23, 59, 59, 999);
      const from = new Date(2020, 0, 1);
      from.setHours(0, 0, 0, 0);
      return { from, to };
    },
  },
];

type DateRangePickerProps = {
  from: Date;
  to: Date;
  onChange: (range: { from: Date; to: Date }) => void;
};

export function DateRangePicker({ from, to, onChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);

  const [draft, setDraft] = useState<Date | null>(null);

  const handleSelect = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      const newFrom = new Date(range.from);
      newFrom.setHours(0, 0, 0, 0);
      const newTo = new Date(range.to);
      newTo.setHours(23, 59, 59, 999);
      setDraft(null);
      onChange({ from: newFrom, to: newTo });
    } else if (range?.from) {
      setDraft(range.from);
    }
  };

  const handlePreset = (preset: Preset) => {
    onChange(preset.getValue());
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-8 gap-1.5 rounded-lg border-neutral-200 dark:border-border px-3 text-[12px] font-medium text-neutral-600 dark:text-neutral-400",
          )}
        >
          <IconCalendar size={14} stroke={1.5} />
          <span>
            {format(from, "MMM d, yyyy")} – {format(to, "MMM d, yyyy")}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0"
        align="end"
        sideOffset={8}
      >
        <div className="flex gap-1.5 border-b border-neutral-100 dark:border-border/50 px-3 py-2.5">
          {presets.map((preset) => (
            <button
              key={preset.label}
              onClick={() => handlePreset(preset)}
              className="rounded-md px-2.5 py-1 text-[11px] font-medium text-neutral-500 dark:text-neutral-400 transition-colors hover:bg-neutral-100 dark:hover:bg-accent hover:text-neutral-700 dark:hover:text-neutral-300"
            >
              {preset.label}
            </button>
          ))}
        </div>
        <Calendar
          mode="range"
          selected={draft ? { from: draft, to: undefined } : { from, to }}
          onSelect={handleSelect}
          numberOfMonths={2}
          defaultMonth={new Date(from.getFullYear(), from.getMonth())}
          disabled={{ after: new Date() }}
        />
      </PopoverContent>
    </Popover>
  );
}
