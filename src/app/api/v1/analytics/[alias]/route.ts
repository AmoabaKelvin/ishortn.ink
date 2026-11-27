import { getPlanCaps } from "@/lib/billing/plans";
import { analyticsWindow, mergeArchivedClicks, summarizeArchived } from "@/lib/core/analytics";
import { db } from "@/server/db";

import { apiError } from "../../errors";
import {
  apiLinkFilter,
  getApiDomainParamsFromSearchParams,
  resolveApiDomainForUser,
  withApiKey,
} from "../../utils";
import { countVisits, foldVisitCounts } from "./visit-counts";

import type { NextRequest } from "next/server";

export const GET = withApiKey(
  async (request: NextRequest, token, props: { params: Promise<{ alias: string }> }) => {
    const params = await props.params;
    const alias = params.alias;

    const domain = await resolveApiDomainForUser(
      token,
      getApiDomainParamsFromSearchParams(request.nextUrl.searchParams),
    );
    if (!domain) {
      return apiError(403, "forbidden", "Domain not available for this API key");
    }

    // Same window the dashboard applies for the plan (all-time when uncapped).
    const window = analyticsWindow(getPlanCaps(token.plan).analyticsRangeLimitDays, new Date());
    const from = window.from;

    const link = await db.query.link.findFirst({
      // Same ownership rule as the links endpoint: API keys only reach links in
      // their own workspace.
      where: (table, { eq, and }) =>
        and(eq(table.alias, alias), eq(table.domain, domain), apiLinkFilter(token)),
      columns: { id: true },
    });

    if (!link) {
      return apiError(404, "not_found", "Link not found");
    }

    const [visitCounts, summaries] = await Promise.all([
      countVisits(link.id, from),
      db.query.linkVisitDailySummary.findMany({
        where: (table, { eq, and, gte }) =>
          from
            ? and(eq(table.linkId, link.id), gte(table.date, from.toISOString().slice(0, 10)))
            : eq(table.linkId, link.id),
      }),
    ]);
    const archived = summarizeArchived(summaries);

    const aggregatedVisits = foldVisitCounts(visitCounts);

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
