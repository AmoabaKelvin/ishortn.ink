"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, useContext, useOptimistic, useTransition } from "react";

import { cn } from "@/lib/utils";

import type { CustomRange } from "@/lib/core/analytics";

type RangeTransitionValue = {
  range: string;
  /** The days of a custom range; null for every other range. */
  custom: CustomRange | null;
  isPending: boolean;
  setRange: (range: string, custom?: CustomRange) => void;
};

const RangeTransitionContext = createContext<RangeTransitionValue | null>(null);

/**
 * Owns the analytics range for a page. `range` comes from the server (the
 * effective range for the current URL), so the selector follows Back/Forward;
 * the optimistic copy shows the new choice while the page re-renders.
 */
export function RangeTransitionProvider({
  range,
  custom = null,
  children,
}: {
  range: string;
  custom?: CustomRange | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic({ range, custom });

  const setRange = (next: string, nextCustom?: CustomRange) => {
    // Merge so filters and ?domain survive the range change.
    const params = new URLSearchParams(searchParams);
    params.set("range", next);
    if (nextCustom) {
      params.set("from", nextCustom.from);
      params.set("to", nextCustom.to);
    } else {
      params.delete("from");
      params.delete("to");
    }
    startTransition(() => {
      setOptimistic({ range: next, custom: nextCustom ?? null });
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  return (
    <RangeTransitionContext.Provider value={{ ...optimistic, isPending, setRange }}>
      {children}
    </RangeTransitionContext.Provider>
  );
}

export function useRangeTransition() {
  const value = useContext(RangeTransitionContext);
  if (!value) throw new Error("useRangeTransition must be used inside RangeTransitionProvider");
  return value;
}

/** Dims page content while a range change is loading. */
export function RangePendingContent({ children }: { children: React.ReactNode }) {
  const { isPending } = useRangeTransition();
  return (
    <div
      aria-busy={isPending}
      className={cn(
        "transition-opacity duration-200",
        isPending && "pointer-events-none opacity-60",
      )}
    >
      {children}
    </div>
  );
}
