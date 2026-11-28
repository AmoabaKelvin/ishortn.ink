import { and, desc, eq, inArray, isNull, lt, or } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/server/db";
import { link } from "@/server/db/schema";
import { ServerTiming } from "@/server/lib/server-timing";

import { apiError, errorResponse, readJsonBody, validationError } from "../errors";
import {
  apiLinkFilter,
  getApiReadableDomains,
  resolveApiDomainForUser,
  restrictedAccountResponse,
  toApiLink,
  withApiKey,
} from "../utils";
import { createTokenLink, shortenLinkSchema } from "./create";
import { decodeLinkCursor, encodeLinkCursor } from "./cursor";

import type { LinkCursor } from "./cursor";
import type { NextRequest } from "next/server";

const listLinksQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z
    .string()
    .transform((value, ctx) => {
      const cursor = decodeLinkCursor(value);
      if (!cursor) {
        ctx.addIssue({ code: "custom", message: "Invalid cursor" });
        return z.NEVER;
      }
      return cursor;
    })
    .optional(),
  domain: z.string().optional(),
});

/**
 * Newest first. Scoped like GET /links/{alias}: the key's workspace, on a platform
 * domain or one of the workspace's active custom domains.
 */
export const GET = withApiKey(async (request: NextRequest, token) => {
  const query = listLinksQuery.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!query.success) return validationError(query.error, "Query parameters are invalid");
  const { limit, cursor } = query.data;

  let domainFilter;
  if (query.data.domain?.trim()) {
    const domain = await resolveApiDomainForUser(token, { domain: query.data.domain });
    if (!domain) return apiError(403, "forbidden", "Domain not available for this API key");
    domainFilter = eq(link.domain, domain);
  } else {
    domainFilter = inArray(link.domain, await getApiReadableDomains(token));
  }

  const rows = await db
    .select({
      id: link.id,
      createdAt: link.createdAt,
      domain: link.domain,
      alias: link.alias,
      url: link.url,
      disableLinkAfterDate: link.disableLinkAfterDate,
      activateAt: link.activateAt,
      disableLinkAfterClicks: link.disableLinkAfterClicks,
    })
    .from(link)
    .where(and(apiLinkFilter(token), domainFilter, cursor ? afterCursor(cursor) : undefined))
    .orderBy(desc(link.createdAt), desc(link.id))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return Response.json({
    data: page.map(toApiLink),
    nextCursor: rows.length > limit && last ? encodeLinkCursor(last) : null,
  });
});

function afterCursor({ createdAt, id }: LinkCursor) {
  // MySQL sorts NULL first ascending, so undated rows come after every dated one here.
  if (!createdAt) return and(isNull(link.createdAt), lt(link.id, id));
  return or(
    lt(link.createdAt, createdAt),
    and(eq(link.createdAt, createdAt), lt(link.id, id)),
    isNull(link.createdAt),
  );
}

// Every response, refusals included, carries a Server-Timing header with the create steps.
export async function POST(request: Request): Promise<Response> {
  const serverTiming = new ServerTiming();
  const response = await withApiKey(async (request: Request, token) => {
    const restricted = restrictedAccountResponse(token);
    if (restricted) return restricted;

    const body = await readJsonBody(request);
    if (!body.ok) return body.response;

    const input = shortenLinkSchema.safeParse(body.body);
    if (!input.success) return validationError(input.error);

    try {
      const newLink = await createTokenLink(token, input.data, "api", serverTiming);
      return Response.json(newLink, { status: 201 });
    } catch (error) {
      return errorResponse(error);
    }
  }, serverTiming)(request);
  return serverTiming.apply(response);
}
