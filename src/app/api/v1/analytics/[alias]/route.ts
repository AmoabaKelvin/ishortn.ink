import { aggregateVisits, mergeArchivedClicks, summarizeArchived } from "@/lib/core/analytics";
import { db } from "@/server/db";

import {
  getApiDomainParamsFromSearchParams,
  resolveApiDomainForUser,
  validateAndGetToken,
} from "../../utils";

import type { NextRequest } from "next/server";
export async function GET(request: NextRequest, props: { params: Promise<{ alias: string }> }) {
  const params = await props.params;
  const alias = params.alias;
  const apiKey = request.headers.get("x-api-key");

  const token = await validateAndGetToken(apiKey);
  if (!token) {
    return new Response("Invalid or missing API key", { status: 401 });
  }

  const domain = await resolveApiDomainForUser(
    token.userId,
    getApiDomainParamsFromSearchParams(request.nextUrl.searchParams),
  );
  if (!domain) {
    return new Response("Domain not available for this API key", { status: 403 });
  }

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
      linkVisits: true,
      uniqueLinkVisits: true,
    },
  });

  if (!link) {
    return new Response("Link not found", { status: 404 });
  }

  if (link.userId !== token.userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const summaries = await db.query.linkVisitDailySummary.findMany({
    where: (table, { eq }) => eq(table.linkId, link.id),
  });
  const archived = summarizeArchived(summaries);

  const aggregatedVisits = aggregateVisits(link.linkVisits, link.uniqueLinkVisits);

  return Response.json({
    ...aggregatedVisits,
    ...mergeArchivedClicks(aggregatedVisits, archived),
    totalClicks: aggregatedVisits.totalClicks + archived.clicks,
  });
}
