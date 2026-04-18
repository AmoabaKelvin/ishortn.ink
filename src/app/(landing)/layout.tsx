import type { ReactNode } from "react";

export default function LandingLayout({ children }: { children: ReactNode }) {
  return (
    <div data-theme="warm" data-accent="terracotta" className="min-h-screen">
      {children}
    </div>
  );
}
