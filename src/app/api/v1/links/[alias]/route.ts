import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { buildCacheKey, deleteFromCache } from "@/lib/core/cache";
import { logger } from "@/lib/logger";
import { normalizeAlias } from "@/lib/utils";
import { destinationUrlSchema } from "@/lib/utils/destination-url";
import { removeLink } from "@/server/api/routers/link/link.service";
import { checkAliasAvailability, validateAlias } from "@/server/api/routers/link/utils";
import { db } from "@/server/db";
import { link } from "@/server/db/schema";
import { previousAddressCacheKeys, recordAddressChange } from "@/server/lib/link-address";
import { assertUrlSafe } from "@/server/lib/phishing";
import { recordSafetyFollowUp } from "@/server/lib/phishing/follow-up";
import { checkCampaignPatternsAfterResponse } from "@/server/lib/phishing/rescan";

import { apiError, errorResponse, readJsonBody, validationError } from "../../errors";
import {
  apiDomainWriteError,
  apiSafetyAccount,
  getApiDomainParamsFromSearchParams,
  resolveApiDomainForUser,
  restrictedAccountResponse,
  toApiLink,
  withApiKey,
} from "../../utils";

import type { ApiToken } from "../../utils";
import type { UrlSafetyResult } from "@/server/lib/phishing";
import type { PersonalWorkspaceContext } from "@/server/lib/workspace";
import type { NextRequest } from "next/server";

const log = logger.child({ component: "api.v1.links" });

const updateLinkSchema = z
  .object({
    url: destinationUrlSchema.optional(),
    alias: z
      .string()
      .min(1)
      .max(20)
      .regex(
        /^[a-zA-Z0-9-_]+$/,
        "Alias can only contain alphanumeric characters, dashes, and underscores",
      )
      .optional(),
    // Moves the link; its old short URL keeps redirecting to it.
    domain: z.string().trim().min(1).max(255).optional(),
    expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
    activatesAt: z.string().datetime({ offset: true }).nullable().optional(),
    expiresAfter: z.number().int().positive().nullable().optional(),
  })
  .strict();

type LinkUpdate = {
  url?: string;
  alias?: string;
  domain?: string;
  disableLinkAfterDate?: Date | null;
  activateAt?: Date | null;
  disableLinkAfterClicks?: number | null;
  clickLimitCount?: null;
};

export const GET = withApiKey(
  async (request: NextRequest, token, props: { params: Promise<{ alias: string }> }) => {
    const params = await props.params;
    const alias = params.alias;

    const domain = await resolveApiDomainForUser(
      token.userId,
      getApiDomainParamsFromSearchParams(request.nextUrl.searchParams),
    );
    if (!domain) {
      return apiError(403, "forbidden", "Domain not available for this API key");
    }

    const retrievedLink = await getOwnedLinkByAlias(alias, domain, token.userId);
    if (!retrievedLink) {
      return apiError(404, "not_found", "Link not found");
    }

    return Response.json(toApiLink(retrievedLink));
  },
);

export const PATCH = withApiKey(
  async (request: NextRequest, token, props: { params: Promise<{ alias: string }> }) => {
    const restricted = restrictedAccountResponse(token);
    if (restricted) return restricted;

    const params = await props.params;
    const alias = params.alias;

    const domain = await resolveApiDomainForUser(
      token.userId,
      getApiDomainParamsFromSearchParams(request.nextUrl.searchParams),
    );
    if (!domain) {
      return apiError(403, "forbidden", "Domain not available for this API key");
    }

    const body = await readJsonBody(request);
    if (!body.ok) return body.response;

    // The request body is untrusted, so parse it against a strict allowlist. A
    // plain cast plus `.set(body)` would let any Link column (userId, blocked,
    // passwordHash, cloaking, ...) be mass-assigned.
    const parsed = updateLinkSchema.safeParse(body.body);
    if (!parsed.success) return validationError(parsed.error);

    // Authorize before doing any work. assertUrlSafe below reaches an external
    // reputation service and an LLM, so running it first would let any API key
    // burn those on aliases the caller doesn't own.
    const existingLink = await getOwnedLinkByAlias(alias, domain, token.userId);
    if (!existingLink) {
      return apiError(404, "not_found", "Link not found");
    }

    // Links on a custom domain past the plan's allowance keep redirecting but
    // can't be edited.
    const domainError = await apiDomainWriteError(token.userId, token.graceUsagePlan, domain);
    if (domainError) {
      return apiError(403, "forbidden", domainError);
    }

    const filteredUpdateData: LinkUpdate = {};
    let safety: UrlSafetyResult | undefined;

    if (parsed.data.url !== undefined) {
      // assertUrlSafe throws a TRPCError; surface it as the 400 the create route
      // already returns for the same rejection rather than a generic 500.
      try {
        safety = await assertUrlSafe(parsed.data.url, { account: apiSafetyAccount(token) });
      } catch (error) {
        return errorResponse(error);
      }
      filteredUpdateData.url = parsed.data.url;
    }
    let targetDomain = existingLink.domain;
    if (parsed.data.domain !== undefined) {
      // Same domains the create endpoint accepts: platform, or the key owner's
      // verified custom domains within the plan's allowance.
      const requestedDomain = await resolveApiDomainForUser(token.userId, {
        domain: parsed.data.domain,
      });
      if (!requestedDomain) {
        return apiError(403, "forbidden", "Domain not available for this API key");
      }
      const targetDomainError = await apiDomainWriteError(
        token.userId,
        token.graceUsagePlan,
        requestedDomain,
      );
      if (targetDomainError) {
        return apiError(403, "forbidden", targetDomainError);
      }
      targetDomain = requestedDomain;
    }
    const movesDomain = targetDomain.toLowerCase() !== existingLink.domain.toLowerCase();
    if (movesDomain) filteredUpdateData.domain = targetDomain;

    const newAlias = parsed.data.alias;
    const renamed =
      newAlias !== undefined &&
      normalizeAlias(newAlias) !== normalizeAlias(existingLink.alias ?? "");
    try {
      if (renamed) {
        // Same rules as creating a link: format, the free-plan minimum length and
        // case-insensitive uniqueness (including retired aliases) on the domain.
        await validateAlias({ db }, newAlias, targetDomain, token.plan !== "free", existingLink.id);
      } else if (movesDomain && existingLink.alias) {
        await checkAliasAvailability({ db }, existingLink.alias, targetDomain, existingLink.id);
      }
    } catch (error) {
      return errorResponse(error);
    }
    if (newAlias !== undefined) filteredUpdateData.alias = newAlias;
    if (parsed.data.expiresAt !== undefined) {
      filteredUpdateData.disableLinkAfterDate = parsed.data.expiresAt
        ? new Date(parsed.data.expiresAt)
        : null;
    }
    if (parsed.data.activatesAt !== undefined) {
      if (
        parsed.data.activatesAt &&
        (existingLink.activateAt ? token.graceUsagePlan : token.plan) === "free" &&
        new Date(parsed.data.activatesAt).getTime() !== existingLink.activateAt?.getTime()
      ) {
        return apiError(
          403,
          "forbidden",
          "Scheduled links are only available on Pro and Ultra plans",
        );
      }
      filteredUpdateData.activateAt = parsed.data.activatesAt
        ? new Date(parsed.data.activatesAt)
        : null;
    }
    if (parsed.data.expiresAfter !== undefined) {
      filteredUpdateData.disableLinkAfterClicks = parsed.data.expiresAfter;
      // Visits aren't counted while there is no limit, so a later limit restarts from the
      // recorded total instead of a stale count.
      if (parsed.data.expiresAfter === null) filteredUpdateData.clickLimitCount = null;
    }

    if (Object.keys(filteredUpdateData).length === 0) {
      return apiError(400, "bad_request", "No update fields provided");
    }

    try {
      if ((renamed || movesDomain) && existingLink.alias) {
        await db.transaction(async (tx) => {
          await recordAddressChange(
            tx,
            existingLink.id,
            { domain: existingLink.domain, alias: existingLink.alias ?? "" },
            { domain: targetDomain, alias: newAlias ?? existingLink.alias ?? "" },
          );
          await tx.update(link).set(filteredUpdateData).where(eq(link.id, existingLink.id));
        });
      } else {
        await db.update(link).set(filteredUpdateData).where(eq(link.id, existingLink.id));
      }

      // Refetch by id: ownership is already settled, and the alias may have just
      // changed, so looking it up by alias again would race a concurrent rename.
      const updatedLink = await db.query.link.findFirst({ where: eq(link.id, existingLink.id) });

      if (!updatedLink) {
        return apiError(500, "internal_error", "Failed to retrieve updated link");
      }

      // The redirect path serves from KV for 24h; drop the stale entries (old
      // addresses of a moved link, and the new address, which may hold one of
      // them) so the change takes effect now.
      const staleKeys = [
        buildCacheKey(existingLink.domain, existingLink.alias ?? ""),
        ...(await previousAddressCacheKeys(db, existingLink.id)),
      ];
      if (updatedLink.alias !== existingLink.alias || updatedLink.domain !== existingLink.domain) {
        staleKeys.push(buildCacheKey(updatedLink.domain, updatedLink.alias ?? ""));
      }
      await Promise.all(staleKeys.map((key) => deleteFromCache(key)));
      recordSafetyFollowUp(existingLink.id, safety);
      if (filteredUpdateData.url && filteredUpdateData.url !== existingLink.url) {
        checkCampaignPatternsAfterResponse([
          { linkId: existingLink.id, url: filteredUpdateData.url },
        ]);
      }

      return Response.json(toApiLink(updatedLink));
    } catch (error) {
      log.error({ err: error, alias, domain }, "failed to update link");

      // Check for unique constraint violation. drizzle-orm >= 0.44 wraps driver
      // errors in DrizzleQueryError, so the original mysql2 error lives at error.cause.
      const failures = [error, error instanceof Error ? error.cause : undefined];
      const isDuplicateKey = failures.some(
        (failure) =>
          failure instanceof Error &&
          (failure.message.includes("Duplicate entry") ||
            failure.message.includes("ER_DUP_ENTRY") ||
            ("code" in failure && failure.code === "ER_DUP_ENTRY")),
      );

      if (isDuplicateKey && (filteredUpdateData.alias || filteredUpdateData.domain)) {
        return apiError(409, "conflict", "Alias already exists for this domain");
      }

      return apiError(500, "internal_error", "Failed to update link due to a server error");
    }
  },
);

export const DELETE = withApiKey(
  async (request: NextRequest, token, props: { params: Promise<{ alias: string }> }) => {
    const { alias } = await props.params;

    const domain = await resolveApiDomainForUser(
      token.userId,
      getApiDomainParamsFromSearchParams(request.nextUrl.searchParams),
    );
    if (!domain) {
      return apiError(403, "forbidden", "Domain not available for this API key");
    }

    const existingLink = await getOwnedLinkByAlias(alias, domain, token.userId);
    if (!existingLink) {
      return apiError(404, "not_found", "Link not found");
    }

    try {
      await removeLink(db, personalWorkspace(token), existingLink);
    } catch (error) {
      log.error({ err: error, alias, domain }, "failed to delete link");
      return apiError(500, "internal_error", "Failed to delete link due to a server error");
    }

    return new Response(null, { status: 204 });
  },
);

/** API keys act in the owner's personal workspace (see getOwnedLinkByAlias). */
function personalWorkspace(token: ApiToken): PersonalWorkspaceContext {
  return {
    type: "personal",
    userId: token.userId,
    teamId: null,
    teamSlug: null,
    role: "owner",
    plan: token.plan,
  };
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
