"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, useContext, useOptimistic, useTransition } from "react";

import { cn } from "@/lib/utils";

type RangeTransitionValue = {
  range: string;
  isPending: boolean;
  setRange: (range: string) => void;
};

const RangeTransitionContext = createContext<RangeTransitionValue | null>(null);

/**
 * Owns the analytics range for a page. `range` comes from the server (the
 * effective range for the current URL), so the selector follows Back/Forward;
 * the optimistic copy shows the new choice while the page re-renders.
 */
export function RangeTransitionProvider({
  range,
  children,
}: {
  range: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [optimisticRange, setOptimisticRange] = useOptimistic(range);

  const setRange = (next: string) => {
    // Merge so filters and ?domain survive the range change.
    const params = new URLSearchParams(searchParams);
    params.set("range", next);
    startTransition(() => {
      setOptimisticRange(next);
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  return (
    <RangeTransitionContext.Provider value={{ range: optimisticRange, isPending, setRange }}>
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
