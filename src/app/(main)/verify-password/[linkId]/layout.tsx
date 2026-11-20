import { noIndexMetadata } from "@/lib/seo/indexing";

import type { Metadata } from "next";
import type { ReactNode } from "react";

// The page is a client component, so its metadata lives here.
export const metadata: Metadata = noIndexMetadata;

export default function VerifyPasswordLayout({ children }: { children: ReactNode }) {
  return children;
}
