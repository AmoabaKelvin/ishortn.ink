import type { Metadata } from "next";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { env } from "@/env";

import { DashboardSidebar } from "./_components/dashboard-sidebar";

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
  title: "Posts",
  description: "Manage your posts here",
};

interface Props {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function DashboardPage({ searchParams }: Props) {
  /**
   * Passing multiple promises to `Promise.all` to fetch data in parallel to prevent waterfall requests.
   * Passing promises to the `Posts` component to make them hot promises (they can run without being awaited) to prevent waterfall requests.
   * @see https://www.youtube.com/shorts/A7GGjutZxrs
   * @see https://nextjs.org/docs/app/building-your-application/data-fetching/patterns#parallel-data-fetching
   */

  return (
    <div>
      <div className="flex items-center justify-between px-6">
        <h2 className="text-xl font-semibold leading-tight text-gray-800">Links</h2>
        <Button asChild>
          <Link href="/dashboard/links">Shorten Link</Link>
        </Button>
      </div>

      <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-11">
        <DashboardSidebar numberOfClicks={0} numberOfLinks={0} />
        <div className="col-span-11 md:col-span-7">Something else</div>
      </div>
    </div>
  );
}
