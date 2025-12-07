import { Funnel_Display, Funnel_Sans } from "next/font/google";

import { cn } from "@/lib/utils";

import { DashboardNav } from "./_components/navigation/header";
import { SidebarWrapper } from "./_components/navigation/sidebar-wrapper";

interface Props {
  children: React.ReactNode;
}

const funnelDisplay = Funnel_Display({
  subsets: ["latin"],
  variable: "--font-funnel-display",
  weight: ["400", "700"],
});

const funnelSans = Funnel_Sans({
  subsets: ["latin"],
  variable: "--font-funnel-sans",
  weight: ["400", "700"],
});

export default function DashboardLayout({ children }: Props) {
  return (
    <div className={cn("min-h-screen bg-gray-50", funnelSans.className)}>
      <SidebarWrapper />

      {/* Main content area with left margin for sidebar */}
      <div className="lg:pl-[280px]">
        <div className="mx-auto max-w-[1180px] px-4 pt-16 pb-10 text-black sm:px-6 lg:px-8 lg:pt-10">
          <DashboardNav />
          <div className="mt-7 py-4">{children}</div>
        </div>
      </div>
    </div>
  );
}
