import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { and, desc, eq, inArray, isNull, lt, or } from "drizzle-orm";
import { z } from "zod";

import { destinationUrlSchema } from "@/lib/utils/destination-url";
import { restrictedLinkValues, validateAlias } from "@/server/api/routers/link/utils";
import { db } from "@/server/db";
import { link } from "@/server/db/schema";
import { trackLinkCreation } from "@/server/lib/link-creation/failures";
import { assertUrlSafe } from "@/server/lib/phishing";
import { generateUnreservedAlias } from "@/server/lib/reserved-alias";
import { reserveMonthlyLinkSlot } from "@/server/lib/user-plan";

import { apiError, errorResponse, readJsonBody, validationError } from "../errors";
import {
  apiDomainWriteError,
  getApiReadableDomains,
  resolveApiDomainForUser,
  restrictedAccountResponse,
  toApiLink,
  withApiKey,
} from "../utils";
import { decodeLinkCursor, encodeLinkCursor } from "./cursor";

import type { LinkCursor } from "./cursor";
import type { Plan } from "@/lib/billing/plans";
import type { LinkCreationAttempt } from "@/server/lib/link-creation/failures";
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
 * Newest first. Scoped like GET /links/{alias}: the owner's personal workspace,
 * on a platform domain or one of their active custom domains.
 */
export const GET = withApiKey(async (request: NextRequest, token) => {
  const query = listLinksQuery.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!query.success) return validationError(query.error, "Query parameters are invalid");
  const { limit, cursor } = query.data;

  let domainFilter;
  if (query.data.domain?.trim()) {
    const domain = await resolveApiDomainForUser(token.userId, { domain: query.data.domain });
    if (!domain) return apiError(403, "forbidden", "Domain not available for this API key");
    domainFilter = eq(link.domain, domain);
  } else {
    domainFilter = inArray(link.domain, await getApiReadableDomains(token.userId));
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
    .where(
      and(
        eq(link.userId, token.userId),
        isNull(link.teamId),
        domainFilter,
        cursor ? afterCursor(cursor) : undefined,
      ),
    )
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

export const POST = withApiKey(async (request: Request, token) => {
  const restricted = restrictedAccountResponse(token);
  if (restricted) return restricted;

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const input = shortenLinkSchema.safeParse(body.body);
  if (!input.success) return validationError(input.error);

  const parsedData = input.data;

  try {
    const newLink = await trackLinkCreation(db, "api", token.userId, async (attempt) => {
      const requestedDomain = await resolveApiDomainForUser(token.userId, parsedData);
      if (!requestedDomain) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Domain not available for this API key",
        });
      }
      const plan = token.plan;
      const domainError = await apiDomainWriteError(
        token.userId,
        token.graceUsagePlan,
        requestedDomain,
      );
      if (domainError) {
        throw new TRPCError({ code: "FORBIDDEN", message: domainError });
      }
      if (parsedData.activatesAt && plan === "free") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Scheduled links are only available on Pro and Ultra plans",
        });
      }
      if (parsedData.alias) {
        await validateAlias({ db }, parsedData.alias, requestedDomain, plan !== "free");
      }
      return createNewLink(parsedData, token.userId, plan, requestedDomain, attempt);
    });
    return Response.json(newLink, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
});

const shortenLinkSchema = z.object({
  url: destinationUrlSchema,
  expiresAt: z.string().optional(),
  activatesAt: z.string().datetime({ offset: true }).optional(),
  expiresAfter: z.number().optional(),
  alias: z.string().optional(),
  password: z.string().optional(),
  domain: z.string().optional(),
  utmParams: z
    .object({
      utm_source: z.string().max(255).optional(),
      utm_medium: z.string().max(255).optional(),
      utm_campaign: z.string().max(255).optional(),
      utm_term: z.string().max(255).optional(),
      utm_content: z.string().max(255).optional(),
    })
    .optional(),
});

type ShortenLinkInput = z.infer<typeof shortenLinkSchema>;

async function createNewLink(
  data: ShortenLinkInput,
  userId: string,
  plan: Plan,
  domain: string,
  attempt: LinkCreationAttempt,
) {
  if (data.password) {
    if (plan === "free") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You need to upgrade to a pro plan to use password protection",
      });
    }

    const hashedPassword = bcrypt.hashSync(data.password, 10);
    data.password = hashedPassword;
  }

  // Check for UTM params - Ultra plan only
  if (data.utmParams) {
    const utmParamsValues = Object.values(data.utmParams);
    const hasUtmParams = utmParamsValues.some(
      (value) => value !== undefined && value !== null && value !== "",
    );
    if (hasUtmParams && plan !== "ultra") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message:
          "UTM parameters are only available on the Ultra plan. Please upgrade to use this feature.",
      });
    }
  }

  attempt.step = "safety";
  await assertUrlSafe(data.url);

  attempt.step = "db";

  const newLinkData = {
    url: data.url,
    alias: data.alias ?? (await generateUnreservedAlias(db, domain)),
    disableLinkAfterClicks: data.expiresAfter,
    disableLinkAfterDate: data.expiresAt ? new Date(data.expiresAt) : null,
    activateAt: data.activatesAt ? new Date(data.activatesAt) : null,
    passwordHash: data.password,
    domain,
    userId,
    createdByUserId: userId,
    utmParams: data.utmParams ?? null,
  };

  // Count the link and insert it together so a failed insert doesn't consume
  // quota and parallel requests can't exceed the monthly limit.
  const newLinkId = await db.transaction(async (tx) => {
    const { userRecord } = await reserveMonthlyLinkSlot(userId, tx);
    const newLink = await tx
      .insert(link)
      .values({ ...newLinkData, ...restrictedLinkValues(userRecord.restrictedAt) });
    return newLink[0].insertId;
  });

  const [retrievedLink] = await db.select().from(link).where(eq(link.id, newLinkId));
  return { ...toApiLink(retrievedLink!), isProtected: !!retrievedLink!.passwordHash };
}
