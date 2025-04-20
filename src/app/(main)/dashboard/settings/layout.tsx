import { SidebarNav } from "@/app/(main)/dashboard/settings/_components/settings-navigation";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your account settings",
};

const sidebarNavItems = [
  {
    title: "General",
    href: "/dashboard/settings/general",
  },
  {
    title: "Billing",
    href: "/dashboard/settings/billing",
  },
  {
    title: "Custom domains",
    href: "/dashboard/settings/domains",
  },
  {
    title: "API keys",
    href: "/dashboard/settings/tokens",
  },
];

interface SettingsLayoutProps {
  children: React.ReactNode;
}

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  return (
    <div className="grid gap-8">
      <div className="mb-4">
        <h1 className="text-3xl font-medium">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your account settings
        </p>
      </div>
      <div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
        <aside className="lg:w-1/5">
          <SidebarNav items={sidebarNavItems} />
        </aside>
        <div className="flex-1 lg:max-w-6xl">{children}</div>
      </div>
    </div>
  );
}
