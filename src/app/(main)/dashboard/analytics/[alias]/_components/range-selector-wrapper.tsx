"use client";

import { useTransitionRouter } from "next-view-transitions";

import { RangeSelector } from "./range-selector";

type RangeSelectorWrapperProps = {
  initialRange: string;
  isProPlan: boolean;
  domain: string;
  alias: string;
  basePath?: string;
};

export function RangeSelectorWrapper({
  initialRange,
  isProPlan,
  domain,
  alias,
  basePath,
}: RangeSelectorWrapperProps) {
  const router = useTransitionRouter();

  const handleRangeChange = (newRange: string) => {
    if (basePath) {
      router.push(`${basePath}?range=${newRange}`);
    } else {
      router.push(
        `/dashboard/analytics/${alias}?domain=${domain}&range=${newRange}`
      );
    }
  };

  return (
    <RangeSelector
      initialRange={initialRange}
      isProPlan={isProPlan}
      onRangeChange={handleRangeChange}
    />
  );
}
