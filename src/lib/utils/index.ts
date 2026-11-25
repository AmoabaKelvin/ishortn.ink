import { clsx } from "clsx";
import { formatDistanceToNow } from "date-fns";
import { twMerge } from "tailwind-merge";

import type { ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(
  date: Date | string | number,
  options: Intl.DateTimeFormatOptions = {
    month: "long",
    day: "numeric",
    year: "numeric",
  },
) {
  return new Intl.DateTimeFormat("en-US", {
    ...options,
  }).format(new Date(date));
}

export function formatPrice(price: number | string, options: Intl.NumberFormatOptions = {}) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: options.currency ?? "USD",
    notation: options.notation ?? "compact",
    ...options,
  }).format(Number(price));
}

export function daysSinceDate(date: Date) {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function removeUrlProtocol(url: string) {
  // remove all http, https, www from url
  return url.replace(/(https?:\/\/)?(www\.)?/i, "");
}

/**
 * Normalizes a link alias by converting it to lowercase
 * @param alias The alias to normalize
 * @returns The normalized alias
 */
export function normalizeAlias(alias: string): string {
  return alias.toLowerCase();
}

/**
 * Formats a "YYYY-MM-DD" date string as UTC to prevent timezone shifts.
 * Used by chart components for x-axis tick labels and tooltips.
 */
export function formatChartDate(dateString: string): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const utcDate = new Date(Date.UTC(year!, month! - 1, day!));
  return utcDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Axis tick for a chart bucket: "Nov 20" for a "YYYY-MM-DD" day, "14:00" for a
 * "YYYY-MM-DDTHH" hour (UTC, matching `bucketKey` in `@/lib/core/analytics`).
 */
export function formatChartBucket(key: string): string {
  return key.length > 10 ? `${key.slice(11, 13)}:00` : formatChartDate(key);
}

/** Tooltip label for a chart bucket; hour buckets also show the day. */
export function formatChartBucketLabel(key: string): string {
  return key.length > 10
    ? `${formatChartDate(key.slice(0, 10))}, ${key.slice(11, 13)}:00`
    : formatChartDate(key);
}

/**
 * Formats a "YYYY-MM" month string into a human-readable label.
 * Used by chart and table components for month display.
 */
export function formatChartMonth(monthStr: string): string {
  const [year, month] = monthStr.split("-").map(Number);
  const d = new Date(year!, month! - 1);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function timeAgo(date: Date | string | null): string {
  if (!date) return "";
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}
