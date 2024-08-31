import type { Metadata } from "next";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { env } from "@/env.mjs";
import { api } from "@/trpc/server";

import Links from "./_components/all-links-renderer";
import { DashboardSidebar } from "./_components/dashboard-sidebar";

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
  title: "Dashboard",
  description: "Manage your links and view analytics",
};

interface Props {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function DashboardPage({ searchParams }: Props) {
  const page = Number.parseInt(searchParams.page as string) || 1;
  const pageSize = 10;
  const orderBy = searchParams.orderBy as "createdAt" | "totalClicks";
  const orderDirection = searchParams.orderDirection as "desc" | "asc";

  const { links, totalLinks, totalPages, currentPage, totalClicks } = await api.link.list.query({
    page,
    pageSize,
    orderBy,
    orderDirection,
  });

  const userSubscription = await api.subscriptions.get.query();
  const subscriptions = userSubscription?.subscriptions;
  const userHasProPlan = subscriptions?.status === "active";

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold leading-tight text-gray-800">Links</h2>
        <Button asChild>
          <Link href="/dashboard/link/new">Shorten Link</Link>
        </Button>
      </div>

      <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-11">
        <DashboardSidebar
          numberOfClicks={totalClicks}
          numberOfLinks={totalLinks}
          userHasProPlan={userHasProPlan}
        />
        <div className="col-span-11 md:col-span-7">
          <Links
            links={links}
            totalPages={totalPages}
            currentPage={currentPage}
            totalLinks={totalLinks}
          />
        </div>
      </div>
    </div>
  );
}
