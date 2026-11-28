"use client";

import {
  IconCalendar,
  IconCalendarDot,
  IconCalendarEvent,
  IconCalendarMonth,
  IconCalendarRepeat,
  IconCalendarStats,
  IconCalendarWeek,
  IconClock,
  IconInfinity,
  IconLock,
} from "@tabler/icons-react";
import { format, parseISO, subMonths } from "date-fns";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UpgradeCta } from "@/components/upgrade-cta";
import { FREE_ANALYTICS_RANGES } from "@/lib/core/analytics";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { useRecordPlanLimitView } from "@/lib/hooks/use-record-plan-limit-view";
import { cn } from "@/lib/utils";

import type { CustomRange } from "@/lib/core/analytics";
import type { DateRange } from "react-day-picker";

const rangeOptions = [
  { value: "24h", label: "Last 24 hours", icon: IconClock },
  { value: "7d", label: "Last 7 days", icon: IconCalendarWeek },
  { value: "30d", label: "Last 30 days", icon: IconCalendarMonth },
  { value: "90d", label: "Last 90 days", icon: IconCalendarEvent },
  { value: "this_month", label: "This month", icon: IconCalendar },
  { value: "last_month", label: "Last month", icon: IconCalendarRepeat },
  { value: "this_year", label: "This year", icon: IconCalendarDot },
  { value: "all", label: "All time", icon: IconInfinity },
  { value: "custom", label: "Custom range", icon: IconCalendarStats },
];

const toDay = (date: Date) => format(date, "yyyy-MM-dd");

// The year is shown only when the range leaves the current year.
const formatCustomRange = ({ from, to }: CustomRange) => {
  const year = String(new Date().getFullYear());
  const pattern = from.startsWith(year) && to.startsWith(year) ? "MMM d" : "MMM d, yyyy";
  const start = format(parseISO(from), pattern);
  return from === to ? start : `${start} – ${format(parseISO(to), pattern)}`;
};

type RangeSelectorProps = {
  isProPlan: boolean;
  value: string;
  /** The days of the current custom range, when `value` is "custom". */
  custom?: CustomRange | null;
  onRangeChange: (range: string, custom?: CustomRange) => void;
};

export const RangeSelector = ({
  isProPlan,
  value,
  custom = null,
  onRangeChange,
}: RangeSelectorProps) => {
  // Locked ranges stay selectable (and focusable) so picking one can explain
  // the limit instead of silently doing nothing.
  const [lockedPicked, setLockedPicked] = useState(false);
  const [opened, setOpened] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  // The first day clicked; the range is applied once the second one is.
  const [draftFrom, setDraftFrom] = useState<Date | null>(null);
  const selectTriggerRef = useRef<HTMLButtonElement>(null);
  // Read when the select closes, which can be before the re-render that opens the calendar.
  const customPickedRef = useRef(false);
  const twoMonths = useMediaQuery("(min-width: 640px)");
  useRecordPlanLimitView("analytics_range_view", !isProPlan && opened);

  const activeCustom = value === "custom" ? custom : null;

  const openCalendar = (open: boolean) => {
    setDraftFrom(null);
    setCalendarOpen(open);
  };

  const handleChange = (range: string) => {
    if (!isProPlan && !FREE_ANALYTICS_RANGES.includes(range)) {
      setLockedPicked(true);
      return;
    }
    setLockedPicked(false);
    if (range === "custom") {
      customPickedRef.current = true;
      openCalendar(true);
      return;
    }
    onRangeChange(range);
  };

  const handleDaySelect = (_range: DateRange | undefined, day: Date) => {
    if (!draftFrom) {
      setDraftFrom(day);
      return;
    }
    const [from, to] = day < draftFrom ? [day, draftFrom] : [draftFrom, day];
    openCalendar(false);
    onRangeChange("custom", { from: toDay(from), to: toDay(to) });
  };

  const selectedDays: DateRange | undefined = draftFrom
    ? { from: draftFrom, to: undefined }
    : activeCustom
      ? { from: parseISO(activeCustom.from), to: parseISO(activeCustom.to) }
      : undefined;

  return (
    <div className="relative flex items-center gap-2">
      <Select
        value={value}
        onValueChange={handleChange}
        onOpenChange={(open) => open && setOpened(true)}
      >
        <SelectTrigger
          ref={selectTriggerRef}
          aria-label="Date range"
          className={cn(
            "h-9 border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px]",
            activeCustom ? "w-auto min-w-[180px] gap-2" : "w-[180px]",
          )}
        >
          <SelectValue placeholder="Select range">
            {activeCustom ? (
              <span className="tabular-nums">
                <IconCalendarStats
                  size={14}
                  stroke={1.5}
                  className="mr-1.5 inline-block text-neutral-400 dark:text-muted-foreground"
                />
                {formatCustomRange(activeCustom)}
              </span>
            ) : undefined}
          </SelectValue>
        </SelectTrigger>
        <SelectContent
          // Picking "Custom range" hands focus to the calendar instead of the trigger.
          onCloseAutoFocus={(event) => {
            if (!customPickedRef.current) return;
            customPickedRef.current = false;
            event.preventDefault();
          }}
        >
          {rangeOptions.map((option) => {
            const Icon = option.icon;
            const isLocked = !isProPlan && !FREE_ANALYTICS_RANGES.includes(option.value);
            return (
              <SelectItem
                key={option.value}
                value={option.value}
                aria-label={isLocked ? `${option.label}, Locked, Pro` : undefined}
                className={cn(isLocked && "text-neutral-400 dark:text-muted-foreground")}
              >
                <Icon
                  size={14}
                  stroke={1.5}
                  className="mr-1.5 inline-block text-neutral-400 dark:text-muted-foreground"
                />
                {option.label}
                {isLocked && (
                  <IconLock
                    size={14}
                    stroke={1.5}
                    aria-hidden="true"
                    className="ml-1.5 inline-block text-neutral-400 dark:text-muted-foreground"
                  />
                )}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      {/* Custom range calendar: its trigger stays beside the select while a custom range is active */}
      {(activeCustom || calendarOpen) && (
        <Popover open={calendarOpen} onOpenChange={openCalendar}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Change custom dates"
              className="h-9 w-9 shrink-0 rounded-lg border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50 dark:border-border dark:bg-card dark:text-neutral-400 dark:hover:bg-accent/50"
            >
              <IconCalendar size={16} stroke={1.5} />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={8}
            className="w-auto p-0"
            onCloseAutoFocus={(event) => {
              // With no custom range applied the trigger unmounts, so return focus to the select.
              if (activeCustom) return;
              event.preventDefault();
              selectTriggerRef.current?.focus();
            }}
          >
            <p className="border-b border-neutral-100 px-3 py-2.5 text-[12px] text-neutral-500 dark:border-border/50 dark:text-neutral-400">
              {draftFrom
                ? `From ${format(draftFrom, "MMM d, yyyy")}. Pick the last day.`
                : "Pick the first day of the range."}
            </p>
            <Calendar
              mode="range"
              selected={selectedDays}
              onSelect={handleDaySelect}
              numberOfMonths={twoMonths ? 2 : 1}
              // Two months open on last month and this one, since later days can't be picked.
              defaultMonth={selectedDays?.from ?? subMonths(new Date(), twoMonths ? 1 : 0)}
              disabled={{ after: new Date() }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      )}

      {/* <output> is a status live region; the visual note below only toggles aria-hidden,
          which screen readers don't announce reliably */}
      {!isProPlan && (
        <output className="sr-only">
          {lockedPicked ? "That range is locked. Pro shows your full history." : ""}
        </output>
      )}

      {/* Locked-range note: absolutely placed in the gap below so it fades in without moving anything */}
      {!isProPlan && (
        <p
          aria-hidden={!lockedPicked}
          className={cn(
            "absolute left-0 top-full mt-1 whitespace-nowrap sm:left-auto sm:right-0 text-[12px] leading-4 text-neutral-500 transition-opacity duration-150 ease-out dark:text-neutral-400",
            lockedPicked ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          Pro shows your full history.{" "}
          <UpgradeCta
            requiredPlan="pro"
            source="analytics_range"
            shown={lockedPicked}
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
