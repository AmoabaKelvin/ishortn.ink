"use client";

import { useRouter } from "next/navigation";

import { RangeSelector } from "./range-selector";

type RangeSelectorWrapperProps = {
  initialRange: string;
  isProPlan: boolean;
  domain: string;
  alias: string;
};

export function RangeSelectorWrapper({
  initialRange,
  isProPlan,
  domain,
  alias,
}: RangeSelectorWrapperProps) {
  const router = useRouter();

  const handleRangeChange = (newRange: string) => {
    router.push(`/dashboard/analytics/${alias}?domain=${domain}&range=${newRange}`);
  };

  return (
    <RangeSelector
      initialRange={initialRange}
      isProPlan={isProPlan}
      onRangeChange={handleRangeChange}
    />
  );
}
