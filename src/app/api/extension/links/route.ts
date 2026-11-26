import { TRPCError } from "@trpc/server";
import { getHTTPStatusCodeFromError } from "@trpc/server/http";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { ACCOUNT_RESTRICTED_MESSAGE } from "@/lib/constants/moderation";
import { EXTENSION_UPGRADE_URL } from "@/lib/extension/connect";
import { destinationUrlSchema } from "@/lib/utils/destination-url";
import { db } from "@/server/db";
import { link } from "@/server/db/schema";
import { captureServerEvent } from "@/server/lib/analytics/posthog-server";
import { ServerTiming } from "@/server/lib/server-timing";

import { readJsonBody } from "../../v1/errors";
import { createTokenLink } from "../../v1/links/create";
import { apiReadableLinkDomain } from "../../v1/utils";
import { extensionError, extensionPreflight, withExtensionToken } from "../auth";

import type { ApiToken } from "../../v1/utils";
import type { NextRequest } from "next/server";

export const OPTIONS = extensionPreflight;

const listQuery = z.object({ limit: z.coerce.number().int().min(1).max(20).default(5) });

/** The newest links in the token owner's personal workspace, for the popup's recent list. */
export const GET = withExtensionToken(async (request: NextRequest, token) => {
  const query = listQuery.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!query.success) return extensionError(400, "limit must be between 1 and 20");

  const rows = await db
    .select({ domain: link.domain, alias: link.alias, url: link.url, createdAt: link.createdAt })
    .from(link)
    .where(
      and(eq(link.userId, token.userId), isNull(link.teamId), apiReadableLinkDomain(token.userId)),
    )
    .orderBy(desc(link.createdAt), desc(link.id))
    .limit(query.data.limit);

  return Response.json({
    links: rows.map((row) => ({
      shortUrl: `https://${row.domain}/${row.alias}`,
      url: row.url,
      createdAt: row.createdAt,
    })),
  });
});

// Passwords, scheduling, UTM and expiry stay in the dashboard and /api/v1.
const createLinkBody = z.object({
  url: destinationUrlSchema,
  alias: z
    .string()
    .trim()
    .max(64)
    .optional()
    .transform((alias) => alias || undefined),
  domain: z.string().trim().max(255).optional(),
});

// Every response, refusals included, carries a Server-Timing header with the create steps.
export async function POST(request: Request): Promise<Response> {
  const serverTiming = new ServerTiming();
  const response = await withExtensionToken(async (request: Request, token) => {
    if (token.restrictedAt) return extensionError(403, ACCOUNT_RESTRICTED_MESSAGE);

    const body = await readJsonBody(request);
    if (!body.ok) return extensionError(400, "Request body must be valid JSON");

    const input = createLinkBody.safeParse(body.body);
    if (!input.success) {
      return extensionError(400, input.error.issues[0]?.message ?? "Request body is invalid");
    }

    try {
      const created = await createTokenLink(token, input.data, "extension", serverTiming);
      captureServerEvent(token.userId, "extension_link_created", { plan: token.plan });
      return Response.json(
        {
          shortUrl: created.shortLink,
          alias: created.alias,
          domain: new URL(created.shortLink).hostname,
          url: created.url,
          createdAt: created.createdAt,
        },
        { status: 201 },
      );
    } catch (error) {
      return creationErrorResponse(token, error);
    }
  }, serverTiming)(request);
  return serverTiming.apply(response);
}

/** Plan refusals (FORBIDDEN) carry the upgrade link; other client errors keep their message. */
function creationErrorResponse(token: ApiToken, cause: unknown): Response {
  if (!(cause instanceof TRPCError)) return extensionError(500, "Something went wrong. Try again.");
  if (cause.code === "FORBIDDEN") {
    captureServerEvent(token.userId, "extension_limit_hit", { plan: token.plan });
    return extensionError(403, cause.message, { upgradeUrl: EXTENSION_UPGRADE_URL });
  }
  const status = getHTTPStatusCodeFromError(cause);
  if (status >= 500) return extensionError(500, "Something went wrong. Try again.");
  return extensionError(status === 404 ? 400 : status, cause.message);
}
