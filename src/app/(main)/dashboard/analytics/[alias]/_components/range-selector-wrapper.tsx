"use client";

import { useRangeTransition } from "../../_components/range-transition";
import { RangeSelector } from "./range-selector";

type RangeSelectorWrapperProps = {
  isProPlan: boolean;
};

export function RangeSelectorWrapper({ isProPlan }: RangeSelectorWrapperProps) {
  const { range, custom, setRange } = useRangeTransition();

  return (
    <RangeSelector value={range} custom={custom} isProPlan={isProPlan} onRangeChange={setRange} />
  );
}
