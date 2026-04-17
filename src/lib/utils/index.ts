import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { toast } from "sonner";
import { twMerge } from "tailwind-merge";

import { env } from "@/env.mjs";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getExceptionType = (error: unknown) => {
  const UnknownException = {
    type: "UnknownException",
    status: 500,
    message: "An unknown error occurred",
  };

  if (!error) return UnknownException;

  if ((error as Record<string, unknown>).name === "DatabaseError") {
    return {
      type: "DatabaseException",
      status: 400,
      message: "Duplicate key entry",
    };
  }

  return UnknownException;
};

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

export function absoluteUrl(path: string) {
  return new URL(path, env.NEXT_PUBLIC_APP_URL).href;
}

export function showSuccessToast() {
  toast.success("Copied to clipboard", {
    duration: 2000,
  });
}

export async function copyToClipboard(text: string) {
  await navigator.clipboard.writeText(text);
  showSuccessToast();
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
 * Formats a "YYYY-MM" month string into a human-readable label.
 * Used by chart and table components for month display.
 */
export function formatChartMonth(monthStr: string): string {
  const [year, month] = monthStr.split("-").map(Number);
  const d = new Date(year!, month! - 1);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}
