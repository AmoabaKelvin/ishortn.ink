"use client";

import {
  Calendar,
  CalendarDays,
  CalendarRange,
  Clock,
  History,
  Infinity,
} from "lucide-react";
import React from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const rangeOptions = [
  { value: "24h", label: "Last 24 hours", icon: Clock },
  { value: "7d", label: "Last 7 days", icon: CalendarDays },
  { value: "30d", label: "Last 30 days", icon: CalendarRange },
  { value: "90d", label: "Last 90 days", icon: CalendarRange },
  { value: "this_month", label: "This month", icon: Calendar },
  { value: "this_year", label: "This year", icon: History },
  { value: "all", label: "All time", icon: Infinity },
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
      <SelectTrigger className="w-[180px]">
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
              <Icon className="inline-block h-4 w-4 mr-1.5 text-gray-400" />
              {option.label}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
};
