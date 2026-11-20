import { noIndexMetadata } from "@/lib/seo/indexing";

import type { Metadata } from "next";

// State pages are per-link and transient; keep them out of search results.
export function linkStatusMetadata(title: string): Metadata {
  return { ...noIndexMetadata, title: { absolute: title } };
}
