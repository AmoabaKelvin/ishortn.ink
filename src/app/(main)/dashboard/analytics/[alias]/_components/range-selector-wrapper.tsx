"use client";

import { useRangeTransition } from "../../_components/range-transition";
import { RangeSelector } from "./range-selector";

type RangeSelectorWrapperProps = {
  isProPlan: boolean;
};

export function RangeSelectorWrapper({ isProPlan }: RangeSelectorWrapperProps) {
  const { range, setRange } = useRangeTransition();

  return <RangeSelector value={range} isProPlan={isProPlan} onRangeChange={setRange} />;
}
