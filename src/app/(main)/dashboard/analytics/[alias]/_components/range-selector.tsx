"use client";

import React from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const rangeOptions = [
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "this_month", label: "This month" },
  { value: "this_year", label: "This year" },
  { value: "all", label: "All" },
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
        {rangeOptions.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            disabled={
              !isProPlan && option.value !== "7d" && option.value !== "24h"
            }
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
