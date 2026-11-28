import "@/styles/site.css";
import { AnalyticsProviders } from "@/components/analytics-providers";
import { FirstTouchCapture } from "@/components/attribution/first-touch-capture";
import { getClerkScripts } from "@/lib/auth/clerk-scripts";

import { ClerkWarmup } from "./_components/clerk-warmup";
import { LaunchStrip } from "./_components/launch-strip";

import type { ReactNode } from "react";

export default function LandingLayout({ children }: { children: ReactNode }) {
  return (
    <AnalyticsProviders>
      <div data-theme="site" className="min-h-screen">
        <FirstTouchCapture />
        <ClerkWarmup clerk={getClerkScripts()} />
        <LaunchStrip />
        {children}
      </div>
    </AnalyticsProviders>
  );
}
