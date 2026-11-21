"use client";

import {
  IconCalendar,
  IconCalendarDot,
  IconCalendarEvent,
  IconCalendarMonth,
  IconCalendarWeek,
  IconClock,
  IconInfinity,
  IconLock,
} from "@tabler/icons-react";
import { useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UpgradeCta } from "@/components/upgrade-cta";
import { useRecordPlanLimitView } from "@/lib/hooks/use-record-plan-limit-view";
import { cn } from "@/lib/utils";

const rangeOptions = [
  { value: "24h", label: "Last 24 hours", icon: IconClock },
  { value: "7d", label: "Last 7 days", icon: IconCalendarWeek },
  { value: "30d", label: "Last 30 days", icon: IconCalendarMonth },
  { value: "90d", label: "Last 90 days", icon: IconCalendarEvent },
  { value: "this_month", label: "This month", icon: IconCalendar },
  { value: "this_year", label: "This year", icon: IconCalendarDot },
  { value: "all", label: "All time", icon: IconInfinity },
];

const FREE_RANGES = new Set(["24h", "7d"]);

type RangeSelectorProps = {
  isProPlan: boolean;
  value: string;
  onRangeChange: (range: string) => void;
};

export const RangeSelector = ({ isProPlan, value, onRangeChange }: RangeSelectorProps) => {
  // Locked ranges stay selectable (and focusable) so picking one can explain
  // the limit instead of silently doing nothing.
  const [lockedPicked, setLockedPicked] = useState(false);
  const [opened, setOpened] = useState(false);
  useRecordPlanLimitView("analytics_range_view", !isProPlan && opened);

  const handleChange = (range: string) => {
    if (!isProPlan && !FREE_RANGES.has(range)) {
      setLockedPicked(true);
      return;
    }
    setLockedPicked(false);
    onRangeChange(range);
  };

  return (
    <div className="relative">
      <Select
        value={value}
        onValueChange={handleChange}
        onOpenChange={(open) => open && setOpened(true)}
      >
        <SelectTrigger
          aria-label="Date range"
          className="h-9 w-[180px] border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px]"
        >
          <SelectValue placeholder="Select range" />
        </SelectTrigger>
        <SelectContent>
          {rangeOptions.map((option) => {
            const Icon = option.icon;
            const isLocked = !isProPlan && !FREE_RANGES.has(option.value);
            return (
              <SelectItem
                key={option.value}
                value={option.value}
                aria-label={isLocked ? `${option.label}, Locked, Pro` : undefined}
                className={cn(isLocked && "text-neutral-400 dark:text-neutral-500")}
              >
                <Icon
                  size={14}
                  stroke={1.5}
                  className="mr-1.5 inline-block text-neutral-400 dark:text-neutral-500"
                />
                {option.label}
                {isLocked && (
                  <IconLock
                    size={14}
                    stroke={1.5}
                    aria-hidden="true"
                    className="ml-1.5 inline-block text-neutral-400 dark:text-neutral-500"
                  />
                )}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      {/* Locked-range note: absolutely placed in the gap below so it fades in without moving anything */}
      {!isProPlan && (
        <p
          aria-hidden={!lockedPicked}
          className={cn(
            "absolute right-0 top-full mt-1 whitespace-nowrap text-[12px] leading-4 text-neutral-500 transition-opacity duration-150 ease-out dark:text-neutral-400",
            lockedPicked ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          Pro shows your full history.{" "}
          <UpgradeCta
            requiredPlan="pro"
            source="analytics_range"
            tabIndex={lockedPicked ? undefined : -1}
            className="font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
          >
            Upgrade
          </UpgradeCta>
        </p>
      )}
    </div>
  );
};
