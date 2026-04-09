"use client";

import {
  IconCalendar,
  IconCalendarDot,
  IconCalendarEvent,
  IconCalendarMonth,
  IconCalendarWeek,
  IconClock,
  IconInfinity,
} from "@tabler/icons-react";
import React from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const rangeOptions = [
  { value: "24h", label: "Last 24 hours", icon: IconClock },
  { value: "7d", label: "Last 7 days", icon: IconCalendarWeek },
  { value: "30d", label: "Last 30 days", icon: IconCalendarMonth },
  { value: "90d", label: "Last 90 days", icon: IconCalendarEvent },
  { value: "this_month", label: "This month", icon: IconCalendar },
  { value: "this_year", label: "This year", icon: IconCalendarDot },
  { value: "all", label: "All time", icon: IconInfinity },
];

type RangeSelectorProps = {
  isProPlan: boolean;
  initialRange: string;
  onRangeChange: (range: string) => void;
};

export const RangeSelector = ({
  isProPlan,
  initialRange,
  onRangeChange,
}: RangeSelectorProps) => {
  const [selectedRange, setSelectedRange] = React.useState(initialRange);

  const handleRangeChange = (value: string) => {
    setSelectedRange(value);
    onRangeChange(value);
  };

  return (
    <Select value={selectedRange} onValueChange={handleRangeChange}>
      <SelectTrigger className="h-9 w-[180px] border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px]">
        <SelectValue placeholder="Select range" />
      </SelectTrigger>
      <SelectContent>
        {rangeOptions.map((option) => {
          const Icon = option.icon;
          return (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={
                !isProPlan && option.value !== "7d" && option.value !== "24h"
              }
            >
              <Icon size={14} stroke={1.5} className="mr-1.5 inline-block text-neutral-400 dark:text-neutral-500" />
              {option.label}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
};
