"use client";

import { IconMail } from "@tabler/icons-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { ScheduledReportsDialog } from "./scheduled-reports-dialog";

import type { ScheduledReportTarget } from "./scheduled-reports-dialog";

/** "Email report" on a link's analytics, a folder or a campaign; opens the schedules dialog. */
export function ScheduledReportsButton({
  className,
  ...target
}: ScheduledReportTarget & { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        aria-label="Email report"
        className={cn(
          "h-9 gap-1.5 border-neutral-200 bg-white px-3 text-[13px] text-neutral-700 dark:border-border dark:bg-card dark:text-neutral-300",
          className,
        )}
      >
        <IconMail size={14} stroke={1.5} className="text-neutral-400 dark:text-muted-foreground" />
        {/* Icon only on phones, where it shares a header row with the title */}
        <span className="hidden sm:inline">Email report</span>
      </Button>
      <ScheduledReportsDialog {...target} open={open} onOpenChange={setOpen} />
    </>
  );
}
