import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { generateShortLink } from "@/lib/core/links";
import { restrictedLinkValues, validateAlias } from "@/server/api/routers/link/utils";
import { db } from "@/server/db";
import { link } from "@/server/db/schema";
import { assertUrlSafe } from "@/server/lib/phishing";
import { reserveMonthlyLinkSlot } from "@/server/lib/user-plan";

import {
  apiDomainWriteError,
  resolveApiDomainForUser,
  restrictedAccountResponse,
  withApiKey,
} from "../utils";

import type { Plan } from "@/lib/billing/plans";

export const POST = withApiKey(async (request: Request, token) => {
  const restricted = restrictedAccountResponse(token);
  if (restricted) return restricted;

  const input = shortenLinkSchema.safeParse(await request.json());

  if (!input.success) {
    return new Response(input.error.message, { status: 400 });
  }

  const parsedData = input.data;
  const requestedDomain = await resolveApiDomainForUser(token.userId, parsedData);
  if (!requestedDomain) {
    return new Response("Domain not available for this API key", { status: 403 });
  }
  const plan = token.plan;
  const domainError = await apiDomainWriteError(token.userId, plan, requestedDomain);
  if (domainError) {
    return new Response(domainError, { status: 403 });
  }
  if (parsedData.activatesAt && plan === "free") {
    return new Response("Scheduled links are only available on Pro and Ultra plans", {
      status: 403,
    });
  }

  try {
    if (parsedData.alias) {
      await validateAlias({ db }, parsedData.alias, requestedDomain, plan !== "free");
    }
    const newLink = await createNewLink(parsedData, token.userId, plan, requestedDomain);
    return new Response(JSON.stringify(newLink), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof TRPCError && error.code === "FORBIDDEN") {
      return new Response(error.message, { status: 403 });
    }
    if (error instanceof Error) {
      return new Response(error.message, { status: 400 });
    }
    return new Response("An error occurred", { status: 400 });
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
      throw new Error("You need to upgrade to a pro plan to use password protection");
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
      throw new Error(
        "UTM parameters are only available on the Ultra plan. Please upgrade to use this feature.",
      );
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
