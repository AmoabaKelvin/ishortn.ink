import { TRPCError } from "@trpc/server";
import { getHTTPStatusCodeFromError } from "@trpc/server/http";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { resolvePlan } from "@/lib/billing/plans";
import { generateShortLink } from "@/lib/core/links";
import { restrictedLinkValues, validateAlias } from "@/server/api/routers/link/utils";
import { db } from "@/server/db";
import { link } from "@/server/db/schema";
import { trackLinkCreation } from "@/server/lib/link-creation/failures";
import { assertUrlSafe } from "@/server/lib/phishing";
import { reserveMonthlyLinkSlot } from "@/server/lib/user-plan";

import { resolveApiDomainForUser, restrictedAccountResponse, withApiKey } from "../utils";

import type { LinkCreationAttempt } from "@/server/lib/link-creation/failures";

export const POST = withApiKey(async (request: Request, token) => {
  const restricted = restrictedAccountResponse(token);
  if (restricted) return restricted;

  const input = shortenLinkSchema.safeParse(await request.json());

  if (!input.success) {
    return new Response(input.error.message, { status: 400 });
  }

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
      const plan = resolvePlan(token.subscription ?? null);
      if (parsedData.activatesAt && plan === "free") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Scheduled links are only available on Pro and Ultra plans",
        });
      }
      if (parsedData.alias) {
        await validateAlias({ db }, parsedData.alias, requestedDomain, plan !== "free");
      }
      return createNewLink(
        parsedData,
        token.userId,
        token.subscription?.status,
        token.subscription?.plan,
        requestedDomain,
        attempt,
      );
    });
    return new Response(JSON.stringify(newLink), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof TRPCError && error.code === "FORBIDDEN") {
      return new Response(error.message, { status: 403 });
    }
    if (error instanceof TRPCError && getHTTPStatusCodeFromError(error) < 500) {
      return new Response(error.message, { status: 400 });
    }
    // Server-side failures (database, timeouts) are not the caller's fault and
    // their messages are internal.
    return new Response("An error occurred", { status: 500 });
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

async function createNewLink(
  data: ShortenLinkInput,
  userId: string,
  subStatus: string | undefined | null,
  plan: string | undefined | null,
  domain: string,
  attempt: LinkCreationAttempt,
) {
  if (data.password) {
    if (subStatus !== "active" || subStatus === undefined) {
      throw new TRPCError({
        code: "BAD_REQUEST",
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
        code: "BAD_REQUEST",
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
    const { userRecord } = await reserveMonthlyLinkSlot(userId, tx);
    const newLink = await tx
      .insert(link)
      .values({ ...newLinkData, ...restrictedLinkValues(userRecord.restrictedAt) });
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
