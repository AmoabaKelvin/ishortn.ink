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

// utils/parseReferrer.ts

/**
 * Parses a referrer URL and returns a simplified version.
 *
 * @param referrer The full referrer URL
 * @returns A simplified string representation of the referrer
 */
export function parseReferrer(referrer: string | null): string {
  if (!referrer) return "direct";

  try {
    const url = new URL(referrer);

    // Remove 'www.' if present
    const hostname = url.hostname.replace(/^www\./, "");

    // Handle some common cases
    switch (hostname) {
      case "t.co":
        return "twitter";
      case "l.facebook.com":
      case "lm.facebook.com":
      case "m.facebook.com":
        return "facebook";
      case "linkedin.com":
      case "lnkd.in":
        return "linkedin";
      case "out.reddit.com":
        return "reddit";
      case "away.vk.com":
        return "vkontakte";
      case "com.google.android.gm":
        return "gmail";
    }

    // For other cases, just return the hostname
    // Split by dots and take up to two parts
    const parts = hostname.split(".");
    return parts.slice(-2).join(".");
  } catch (_error) {
    // If parsing fails, return the original string, limited to 50 characters
    return referrer.substring(0, 50);
  }
}

/**
 * Normalizes a link alias by converting it to lowercase
 * @param alias The alias to normalize
 * @returns The normalized alias
 */
export function normalizeAlias(alias: string): string {
  return alias.toLowerCase();
}
