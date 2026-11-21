import type { LinkAnalytics } from "./api";

export type BreakdownEntry = { label: string; clicks: number; share: string };

/**
 * The largest values of a breakdown with their share of it. Shares are of the
 * breakdown's own sum: breakdowns only cover clicks whose raw data is still
 * kept, so the total can be larger.
 */
export function topEntries(counts: Record<string, number>, limit = 5): BreakdownEntry[] {
  const entries = Object.entries(counts).filter(([, clicks]) => clicks > 0);
  const sum = entries.reduce((total, [, clicks]) => total + clicks, 0);
  return entries
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([label, clicks]) => {
      const percent = (clicks / sum) * 100;
      return { label, clicks, share: percent < 1 ? "<1%" : `${Math.round(percent)}%` };
    });
}

export function windowLabel(window: LinkAnalytics["window"]): string {
  if (window.days === null) return "All time";
  return `Last ${window.days} days`;
}

/** Device types arrive lowercase ("mobile"); everything else is shown as stored. */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
