import type { Metadata } from "next";

import { Link } from "next-view-transitions";

import { Button } from "@/components/ui/button";
import { env } from "@/env.mjs";
import { api } from "@/trpc/server";

import { BulkLinkActions } from "./_components/bulk-actions/bulk-actions";
import { Links } from "./_components/links/links";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
  title: "Dashboard",
  description: "Manage your links and view analytics",
};

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DashboardPage(props: Props) {
  const searchParams = await props.searchParams;
  const page = Number.parseInt(searchParams.page as string) || 1;
  const pageSize = 10;
  const orderBy = searchParams.orderBy as "createdAt" | "totalClicks";
  const orderDirection = searchParams.orderDirection as "desc" | "asc";
  const tag = searchParams.tag as string | undefined;
  const archivedFilter = searchParams.archivedFilter as
    | "active"
    | "archived"
    | "all"
    | undefined;
  const search = searchParams.search as string | undefined;

  const { links, totalLinks, totalPages, currentPage } =
    await api.link.list.query({
      page,
      pageSize,
      orderBy,
      orderDirection,
      tag,
      archivedFilter,
      search,
    });

  // const { totalLinks: totalLinksCount, activeLinks } =
  //   await api.link.stats.query();

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-semibold leading-tight text-gray-900">
          Links
        </h2>
        <div className="flex items-center gap-2">
          <Button asChild className="bg-blue-600 hover:bg-blue-700">
            <Link href="/dashboard/link/new">Shorten Link</Link>
          </Button>
          <BulkLinkActions />
        </div>
      </div>

      <Links
        links={links}
        totalPages={totalPages as number}
        currentPage={currentPage as number}
        totalLinks={totalLinks as number}
      />
    </div>
  );
}
