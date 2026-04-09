import type { Metadata } from "next";

import { IconPlus } from "@tabler/icons-react";
import { Link } from "next-view-transitions";

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

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-foreground">
            Links
          </h2>
          {totalLinks > 0 && (
            <p className="mt-1 text-[13px] text-neutral-400 dark:text-neutral-500">
              {totalLinks} {totalLinks === 1 ? "link" : "links"} total
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/link/new"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-blue-700"
          >
            <IconPlus size={16} stroke={2} />
            New Link
          </Link>
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
