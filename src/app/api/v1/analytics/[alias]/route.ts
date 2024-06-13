import { aggregateVisits } from "@/lib/core/analytics";
import { db } from "@/server/db";

import { validateAndGetToken } from "../../utils";

export async function GET(request: Request, { params }: { params: { alias: string } }) {
  const alias = params.alias;
  const apiKey = request.headers.get("x-api-key");

  const token = await validateAndGetToken(apiKey);
  if (!token) {
    return new Response("Invalid or missing API key", { status: 401 });
  }

  const link = await db.query.link.findFirst({
    where: (table, { eq }) => eq(table.alias, alias),
    with: {
      linkVisits: true,
    },
  });

  if (!link) {
    return new Response("Link not found", { status: 404 });
  }

  if (link.userId !== token.userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const aggregatedVisits = aggregateVisits(link.linkVisits);

  return Response.json(aggregatedVisits);
}
