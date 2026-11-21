import { useMediaQuery } from "@/lib/hooks/use-media-query";

/**
 * Whether the click charts should play Recharts' grow-in animation. Off for reduced-motion
 * users, and under browser automation (`navigator.webdriver`) so screenshots and tests
 * capture the final bars instead of a frame mid-animation.
 */
export function useChartAnimation() {
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  // Not every server runtime defines `navigator`; the chart only draws after mount anyway.
  return !prefersReducedMotion && globalThis.navigator?.webdriver !== true;
}
