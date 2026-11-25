import Script from "next/script";

import { PostHogScript } from "@/components/scripts/posthog";
import { env } from "@/env.mjs";

import type { ReactNode } from "react";

// Analytics for the iShortn site itself (marketing, auth, dashboard). Short
// links, interstitials and bio pages render without it. Kept out of
// app-providers.tsx: importing that module from the marketing layout would
// ship Clerk's and tRPC's client chunks even when unused.
export function AnalyticsProviders({ children }: { children: ReactNode }) {
  return (
    <>
      {env.UMAMI_TRACKING_ID && (
        <Script strategy="lazyOnload" src={env.UMAMI_URL} data-website-id={env.UMAMI_TRACKING_ID} />
      )}
      <PostHogScript />
      {children}
    </>
  );
}
