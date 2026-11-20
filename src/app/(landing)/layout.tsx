import "@/styles/site.css";
import { FirstTouchCapture } from "@/components/attribution/first-touch-capture";

import type { ReactNode } from "react";

export default function LandingLayout({ children }: { children: ReactNode }) {
  return (
    <div data-theme="site" className="min-h-screen">
      <FirstTouchCapture />
      {children}
    </div>
  );
}
