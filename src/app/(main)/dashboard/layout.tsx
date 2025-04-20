import { cn } from "@/lib/utils";
import { satoshi } from "@/styles/fonts";

import { DashboardNav } from "./_components/navigation/header";
import { TabSwitcher } from "./_components/navigation/tab-switcher";

interface Props {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: Props) {
  return (
    <div
      className={cn(
        "mx-auto min-h-[calc(100vh-180px)] max-w-[1180px] px-4 py-10 text-black sm:px-6 lg:px-8",
        satoshi.className
      )}
    >
      <DashboardNav />
      <TabSwitcher className="mt-7" />
      <div className="mt-7 py-4 ">{children}</div>
    </div>
  );
}
