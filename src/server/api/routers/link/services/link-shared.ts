/**
 * Shared utilities and types for link services
 */

import { endOfYear, startOfMonth, startOfYear, subDays } from "date-fns";

/**
 * Constructs a cache key for link caching
 */
export function constructCacheKey(domain: string, alias: string) {
  return `${domain}:${alias}`;
}

/**
 * Date range filter options
 */
export type DateRangeFilter =
  | "24h"
  | "7d"
  | "30d"
  | "90d"
  | "this_month"
  | "last_month"
  | "this_year"
  | "last_year"
  | "all";

/**
 * Calculates date range from a filter string
 * Returns start and end dates for the range
 */
export function getDateRangeFromFilter(
  range: string,
  userHasPaidPlan: boolean
): { startDate: Date; endDate: Date } {
  let now = new Date();
  let startDate: Date;
  let effectiveRange = range;

  // Enforce 7-day limit for free users
  if (!userHasPaidPlan && !["24h", "7d"].includes(effectiveRange)) {
    effectiveRange = "7d";
  }

  switch (effectiveRange) {
    case "24h":
      startDate = subDays(now, 1);
      break;
    case "7d":
      startDate = subDays(now, 7);
      break;
    case "30d":
      startDate = subDays(now, 30);
      break;
    case "90d":
      startDate = subDays(now, 90);
      break;
    case "this_month":
      startDate = startOfMonth(now);
      break;
    case "last_month":
      startDate = startOfMonth(subDays(now, 30));
      now.setDate(0); // Set to last day of previous month
      break;
    case "this_year":
      startDate = startOfYear(now);
      break;
    case "last_year":
      startDate = startOfYear(subDays(now, 365));
      now = endOfYear(subDays(now, 365));
      break;
    case "all":
      startDate = new Date(0); // Beginning of time
      break;
    default:
      startDate = subDays(now, 7); // Default to last 7 days
  }

  return { startDate, endDate: now };
}
