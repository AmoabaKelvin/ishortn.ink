"use client";

import { AnimatePresence, motion } from "framer-motion";
import { IconChevronDown, IconDiamond } from "@tabler/icons-react";

import { cn } from "@/lib/utils";

export function SectionToggle({
  title,
  description,
  isOpen,
  onToggle,
  badge,
  children,
}: {
  title: string;
  description: string;
  isOpen: boolean;
  onToggle: () => void;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-border p-4">
      <button
        type="button"
        className="flex w-full items-center justify-between text-left"
        onClick={onToggle}
      >
        <div className="flex flex-col gap-0.5">
          <p className="flex items-center gap-2 text-[14px] font-semibold text-neutral-900 dark:text-foreground">
            {title}
            {badge}
          </p>
          <span className="text-[12px] text-neutral-400 dark:text-neutral-500">{description}</span>
        </div>
        <IconChevronDown
          size={16}
          stroke={1.5}
          className={cn(
            "shrink-0 text-neutral-400 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-4 space-y-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function PlanBadge({ plan }: { plan: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 dark:border-border bg-neutral-50 dark:bg-accent/50 px-2 py-px text-[11px] font-medium uppercase text-neutral-500 dark:text-neutral-400">
      <IconDiamond size={12} stroke={1.5} className="text-neutral-400" />
      {plan}
    </span>
  );
}
