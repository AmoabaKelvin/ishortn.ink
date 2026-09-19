import "@/styles/site.css";
import type { ReactNode } from "react";

export default function LandingLayout({ children }: { children: ReactNode }) {
  return (
    <div data-theme="site" className="min-h-screen">
      {children}
    </div>
  );
}
