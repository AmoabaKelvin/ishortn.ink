import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { logger } from "@/lib/logger";
import { db } from "@/server/db";
import { link } from "@/server/db/schema";
import { assertUrlSafe } from "@/server/lib/phishing";

import {
  getApiDomainParamsFromSearchParams,
  resolveApiDomainForUser,
  validateAndGetToken,
} from "../../utils";

import type { NextRequest } from "next/server";

const log = logger.child({ component: "api.v1.links" });

const updateLinkSchema = z
  .object({
    url: z.string().url().optional(),
    alias: z
      .string()
      .min(1)
      .max(20)
      .regex(/^[a-zA-Z0-9-_]+$/, "Alias can only contain alphanumeric characters, dashes, and underscores")
      .optional(),
    expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
    expiresAfter: z.number().int().positive().nullable().optional(),
  })
  .strict();

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

  const retrievedLink = await getOwnedLinkByAlias(alias, domain, token.userId);
  if (!retrievedLink) {
    return new Response("Link not found", { status: 404 });
  }

  return Response.json(toApiLink(retrievedLink));
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ alias: string }> }) {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid request body", { status: 400 });
  }

  // The request body is untrusted, so parse it against a strict allowlist. A
  // plain cast plus `.set(body)` would let any Link column (userId, blocked,
  // passwordHash, cloaking, ...) be mass-assigned.
  const parsed = updateLinkSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(parsed.error.message, { status: 400 });
  }

  // Authorize before doing any work. assertUrlSafe below reaches an external
  // reputation service and an LLM, so running it first would let any API key
  // burn those on aliases the caller doesn't own.
  const existingLink = await getOwnedLinkByAlias(alias, domain, token.userId);
  if (!existingLink) {
    return new Response("Link not found", { status: 404 });
  }

  const filteredUpdateData: {
    url?: string;
    alias?: string;
    disableLinkAfterDate?: Date | null;
    disableLinkAfterClicks?: number | null;
  } = {};

  if (parsed.data.url !== undefined) {
    // assertUrlSafe throws a TRPCError; surface it as the 400 the create route
    // already returns for the same rejection rather than a generic 500.
    try {
      await assertUrlSafe(parsed.data.url);
    } catch (error) {
      const message = error instanceof Error ? error.message : "URL is not allowed";
      return new Response(message, { status: 400 });
    }
    filteredUpdateData.url = parsed.data.url;
  }
  if (parsed.data.alias !== undefined) filteredUpdateData.alias = parsed.data.alias;
  if (parsed.data.expiresAt !== undefined) {
    filteredUpdateData.disableLinkAfterDate = parsed.data.expiresAt
      ? new Date(parsed.data.expiresAt)
      : null;
  }
  if (parsed.data.expiresAfter !== undefined) {
    filteredUpdateData.disableLinkAfterClicks = parsed.data.expiresAfter;
  }

  if (Object.keys(filteredUpdateData).length === 0) {
    return new Response("No update fields provided", { status: 400 });
  }

  try {
    await db.update(link).set(filteredUpdateData).where(eq(link.id, existingLink.id));

    // Refetch by id: ownership is already settled, and the alias may have just
    // changed, so looking it up by alias again would race a concurrent rename.
    const updatedLink = await db.query.link.findFirst({ where: eq(link.id, existingLink.id) });

    if (!updatedLink) {
      return new Response("Failed to retrieve updated link", { status: 500 });
    }

    return Response.json(toApiLink(updatedLink));
  } catch (error) {
    log.error({ err: error, alias, domain }, "failed to update link");

    // Check for unique constraint violation. drizzle-orm >= 0.44 wraps driver
    // errors in DrizzleQueryError, so the original mysql2 error lives at error.cause.
    const cause =
      error instanceof Error && error.cause instanceof Error ? error.cause : error;
    const isDuplicateKey = (candidate: unknown) =>
      candidate instanceof Error &&
      (candidate.message.includes("Duplicate entry") ||
        candidate.message.includes("ER_DUP_ENTRY") ||
        (candidate as { code?: string }).code === "ER_DUP_ENTRY");

    if ((isDuplicateKey(error) || isDuplicateKey(cause)) && filteredUpdateData.alias) {
      return new Response("Alias already exists for this domain", {
        status: 409,
      }); // 409 Conflict
    }

    // Generic error for other database issues or unexpected errors
    return new Response("Failed to update link due to a server error", {
      status: 500,
    });
  }
}

/**
 * Loads a link by (alias, domain) but only when it belongs to the API token
 * owner's personal workspace. (alias, domain) is public information, so
 * without the ownership predicate any token could read or rewrite any
 * account's short link.
 */
async function getOwnedLinkByAlias(alias: string, domain: string, userId: string) {
  return db.query.link.findFirst({
    where: and(
      eq(link.alias, alias),
      eq(link.domain, domain),
      eq(link.userId, userId),
      isNull(link.teamId),
    ),
  });
}

function toApiLink(retrievedLink: {
  domain: string;
  alias: string | null;
  url: string | null;
  disableLinkAfterDate: Date | null;
  disableLinkAfterClicks: number | null;
}) {
  return {
    shortLink: `https://${retrievedLink.domain}/${retrievedLink.alias}`,
    url: retrievedLink.url,
    alias: retrievedLink.alias,
    expiresAt: retrievedLink.disableLinkAfterDate,
    expiresAfter: retrievedLink.disableLinkAfterClicks,
  };
}
