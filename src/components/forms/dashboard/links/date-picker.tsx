"use client";

import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface LinkExpirationDatePickerProps {
  setSeletectedDate: (date: Date) => void;
}

export function LinkExpirationDatePicker({
  setSeletectedDate,
}: LinkExpirationDatePickerProps) {
  const [date, setDate] = React.useState<Date>();

  const handleSelect = (date: Date) => {
    setDate(date);
    setSeletectedDate(date);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal",
            !date && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="w-4 h-4 mr-2" />
          {date ? format(date, "PPP") : <span>Pick a date</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(date) => handleSelect(date!)}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
