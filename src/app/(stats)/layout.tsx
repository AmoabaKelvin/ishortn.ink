import { Funnel_Sans } from "next/font/google";

import { AnalyticsProviders } from "@/components/analytics-providers";
import { cn } from "@/lib/utils";

import type { ReactNode } from "react";

const funnelSans = Funnel_Sans({
  subsets: ["latin"],
  weight: ["400", "700"],
});

// Public, signed-out pages on the app host: site analytics (for the $pageview), no Clerk or tRPC.
export default function StatsLayout({ children }: { children: ReactNode }) {
  return (
    <AnalyticsProviders>
      <div className={cn("min-h-[100dvh] bg-neutral-50 dark:bg-accent/50", funnelSans.className)}>
        {children}
      </div>
    </AnalyticsProviders>
  );
}
