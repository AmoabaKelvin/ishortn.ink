import type { Metadata } from "next";

// State pages are per-link and transient; keep them out of search results.
export function linkStatusMetadata(title: string): Metadata {
  return { title: { absolute: title }, robots: { index: false, follow: false } };
}
