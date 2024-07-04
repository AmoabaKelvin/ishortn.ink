import type { Metadata } from "next";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { env } from "@/env";
import { api } from "@/trpc/server";

import { DashboardSidebar } from "./_components/dashboard-sidebar";
import Links from "./_components/links";

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
  title: "Dashboard",
  description: "Manage your links and view analytics",
};

interface Props {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function DashboardPage({ searchParams }: Props) {
  const links = await api.link.list.query();

  const totalClicks = links.reduce((acc, link) => acc + link.totalClicks, 0);

  return (
    <div>
      <div className="flex items-center justify-between px-6">
        <h2 className="text-xl font-semibold leading-tight">Links</h2>
        <Button asChild>
          <Link href="/dashboard/link/new">Shorten Link</Link>
        </Button>
      </div>

      <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-11">
        <DashboardSidebar numberOfClicks={totalClicks} numberOfLinks={links.length} />
        <div className="col-span-11 md:col-span-7">
          <Links links={links} />
        </div>
      </div>
    </div>
  );
}
