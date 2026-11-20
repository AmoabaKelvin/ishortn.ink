import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { generateShortLink } from "@/lib/core/links";
import { validateAlias } from "@/server/api/routers/link/utils";
import { db } from "@/server/db";
import { link } from "@/server/db/schema";
import { assertUrlSafe } from "@/server/lib/phishing";
import { reserveMonthlyLinkSlot } from "@/server/lib/user-plan";

import { apiError, errorResponse, readJsonBody, validationError } from "../errors";
import { resolveApiDomainForUser, withApiKey } from "../utils";

import type { Plan } from "@/lib/billing/plans";

export const POST = withApiKey(async (request: Request, token) => {
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const input = shortenLinkSchema.safeParse(body.body);
  if (!input.success) return validationError(input.error);

  const parsedData = input.data;
  const requestedDomain = await resolveApiDomainForUser(token.userId, parsedData);
  if (!requestedDomain) {
    return apiError(403, "forbidden", "Domain not available for this API key");
  }
  if (parsedData.activatesAt && token.plan === "free") {
    return apiError(403, "forbidden", "Scheduled links are only available on Pro and Ultra plans");
  }

  try {
    if (parsedData.alias) {
      await validateAlias({ db }, parsedData.alias, requestedDomain, token.plan !== "free");
    }
    const newLink = await createNewLink(parsedData, token.userId, token.plan, requestedDomain);
    return Response.json(newLink, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
});

const shortenLinkSchema = z.object({
  url: z.string().url(),
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

async function createNewLink(data: ShortenLinkInput, userId: string, plan: Plan, domain: string) {
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

  await assertUrlSafe(data.url);

  const newLinkData = {
    url: data.url,
    alias: data.alias ?? (await generateShortLink()),
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
    await reserveMonthlyLinkSlot(userId, tx);
    const newLink = await tx.insert(link).values(newLinkData);
    return newLink[0].insertId;
  });

  const retrievedLink = await db.select().from(link).where(eq(link.id, newLinkId));
  return {
    shortLink: `https://${retrievedLink[0]!.domain}/${retrievedLink[0]!.alias}`,
    url: retrievedLink[0]!.url,
    alias: retrievedLink[0]!.alias,
    expiresAt: retrievedLink[0]!.disableLinkAfterDate,
    activatesAt: retrievedLink[0]!.activateAt,
    expiresAfter: retrievedLink[0]!.disableLinkAfterClicks,
    isProtected: !!retrievedLink[0]!.passwordHash,
  };
}
