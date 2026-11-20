import { getPlanCaps } from "@/lib/billing/plans";
import {
  aggregateVisits,
  analyticsWindow,
  mergeArchivedClicks,
  summarizeArchived,
} from "@/lib/core/analytics";
import { db } from "@/server/db";

import {
  getApiDomainParamsFromSearchParams,
  resolveApiDomainForUser,
  withApiKey,
} from "../../utils";

import type { NextRequest } from "next/server";

export const GET = withApiKey(
  async (request: NextRequest, token, props: { params: Promise<{ alias: string }> }) => {
    const params = await props.params;
    const alias = params.alias;

    const domain = await resolveApiDomainForUser(
      token.userId,
      getApiDomainParamsFromSearchParams(request.nextUrl.searchParams),
    );
    if (!domain) {
      return new Response("Domain not available for this API key", { status: 403 });
    }

    // Same window the dashboard applies for the plan (all-time when uncapped).
    const window = analyticsWindow(getPlanCaps(token.plan).analyticsRangeLimitDays, new Date());
    const from = window.from;

    const link = await db.query.link.findFirst({
      // Same ownership rule as the links endpoint: API tokens only reach links in
      // the owner's personal workspace.
      where: (table, { eq, and, isNull }) =>
        and(
          eq(table.alias, alias),
          eq(table.domain, domain),
          eq(table.userId, token.userId),
          isNull(table.teamId),
        ),
      with: {
        linkVisits: from ? { where: (visit, { gte }) => gte(visit.createdAt, from) } : true,
        uniqueLinkVisits: from ? { where: (visit, { gte }) => gte(visit.createdAt, from) } : true,
      },
    });

    if (!link) {
      return new Response("Link not found", { status: 404 });
    }

    if (link.userId !== token.userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    const summaries = await db.query.linkVisitDailySummary.findMany({
      where: (table, { eq, and, gte }) =>
        from
          ? and(eq(table.linkId, link.id), gte(table.date, from.toISOString().slice(0, 10)))
          : eq(table.linkId, link.id),
    });
    const archived = summarizeArchived(summaries);

    const aggregatedVisits = aggregateVisits(link.linkVisits, link.uniqueLinkVisits);

    return Response.json({
      ...aggregatedVisits,
      ...mergeArchivedClicks(aggregatedVisits, archived),
      totalClicks: aggregatedVisits.totalClicks + archived.clicks,
      window: {
        days: window.days,
        from: from?.toISOString() ?? null,
        to: window.to.toISOString(),
      },
    });
  },
);
