import "@/styles/site.css";
import { AnalyticsProviders } from "@/components/analytics-providers";
import { FirstTouchCapture } from "@/components/attribution/first-touch-capture";

import type { ReactNode } from "react";

export default function LandingLayout({ children }: { children: ReactNode }) {
  return (
    <AnalyticsProviders>
      <div data-theme="site" className="min-h-screen">
        <FirstTouchCapture />
        {children}
      </div>
    </AnalyticsProviders>
  );
}
