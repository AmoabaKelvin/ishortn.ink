import { aggregateVisits } from "@/lib/core/analytics";
import { db } from "@/server/db";

import { validateAndGetToken } from "../../utils";

import type { NextRequest } from "next/server";
export async function GET(request: NextRequest, { params }: { params: { alias: string } }) {
  const alias = params.alias;
  const apiKey = request.headers.get("x-api-key");

  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('domain')
  const domain = query ?? "ishortn.ink"

  const token = await validateAndGetToken(apiKey);
  if (!token) {
    return new Response("Invalid or missing API key", { status: 401 });
  }

  const link = await db.query.link.findFirst({
    where: (table, { eq, and }) => and(eq(table.alias, alias), eq(table.domain, domain)),
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

  const aggregatedVisits = aggregateVisits(link.linkVisits, link.uniqueLinkVisits);

  return Response.json(aggregatedVisits);
}
