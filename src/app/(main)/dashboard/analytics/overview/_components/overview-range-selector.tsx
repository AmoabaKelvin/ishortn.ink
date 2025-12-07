"use client";

import { useTransitionRouter } from "next-view-transitions";

import { RangeSelector } from "../../[alias]/_components/range-selector";

type OverviewRangeSelectorProps = {
  initialRange: string;
  isProPlan: boolean;
};

export function OverviewRangeSelector({
  initialRange,
  isProPlan,
}: OverviewRangeSelectorProps) {
  const router = useTransitionRouter();

  const handleRangeChange = (newRange: string) => {
    router.push(`/dashboard/analytics/overview?range=${newRange}`);
  };

  return (
    <RangeSelector
      initialRange={initialRange}
      isProPlan={isProPlan}
      onRangeChange={handleRangeChange}
    />
  );
}

