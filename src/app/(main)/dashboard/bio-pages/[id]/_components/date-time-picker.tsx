"use client";

import { IconCalendar } from "@tabler/icons-react";
import { format } from "date-fns";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Props = {
  value: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
};

export function DateTimePicker({ value, onChange, placeholder = "Pick a date" }: Props) {
  const [open, setOpen] = useState(false);
  const timeValue = value ? format(value, "HH:mm") : "09:00";

  function handleDateSelect(date: Date | undefined) {
    if (!date) return;
    const [h, m] = timeValue.split(":").map(Number);
    const next = new Date(date);
    next.setHours(h ?? 9, m ?? 0, 0, 0);
    onChange(next);
  }

  function handleTimeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const [h, m] = e.target.value.split(":").map(Number);
    const base = value ? new Date(value) : new Date();
    base.setHours(h ?? 0, m ?? 0, 0, 0);
    onChange(base);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full justify-start gap-2 font-normal",
            !value && "text-muted-foreground",
          )}
        >
          <IconCalendar size={15} stroke={1.5} className="shrink-0" />
          <span className="truncate">
            {value ? format(value, "MMM d, yyyy · HH:mm") : placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value ?? undefined}
          onSelect={handleDateSelect}
          initialFocus
        />
        <div className="flex items-center gap-2 border-t border-border p-3">
          <Input
            type="time"
            value={timeValue}
            onChange={handleTimeChange}
            className="flex-1"
            aria-label="Time"
          />
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
