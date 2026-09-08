import { IconPlus } from "@tabler/icons-react";
import { Link } from "next-view-transitions";
import { z } from "zod";

import { env } from "@/env.mjs";
import {
  linkArchivedFilterEnum,
  linkOrderByEnum,
  linkOrderDirectionEnum,
  listLinksSchema,
} from "@/server/api/routers/link/link.input";
import { api } from "@/trpc/server";

import { AudienceFeedbackCard } from "./_components/audience-feedback-card";
import { BulkLinkActions } from "./_components/bulk-actions/bulk-actions";
import { Links } from "./_components/links/links";

import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
  title: "Dashboard",
  description: "Manage your links and view analytics",
};

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

// Search params are user-controlled: fall back to defaults rather than error.
const dashboardSearchParamsSchema = listLinksSchema.pick({ tag: true, search: true }).extend({
  orderBy: linkOrderByEnum.catch("createdAt"),
  orderDirection: linkOrderDirectionEnum.catch("desc"),
  archivedFilter: linkArchivedFilterEnum.optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1),
  campaign: z.coerce.number().int().optional().catch(undefined),
});

export default async function DashboardPage(props: Props) {
  const { page, orderBy, orderDirection, tag, campaign, archivedFilter, search } =
    dashboardSearchParamsSchema.parse(await props.searchParams);

  const { links, totalLinks, totalPages, currentPage } = await api.link.list.query({
    page,
    pageSize: 10,
    orderBy,
    orderDirection,
    tag,
    campaignId: campaign,
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

      <Links links={links} totalPages={totalPages} currentPage={currentPage} />

      <AudienceFeedbackCard hasLinks={totalLinks > 0} />
    </div>
  );
}
