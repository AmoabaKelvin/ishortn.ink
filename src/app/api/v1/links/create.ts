import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { destinationUrlSchema } from "@/lib/utils/destination-url";
import { linkAliasSchema, linkDomainSchema } from "@/server/api/routers/link/link.input";
import { restrictedLinkValues, validateAlias } from "@/server/api/routers/link/utils";
import { db } from "@/server/db";
import { link } from "@/server/db/schema";
import { trackLinkCreation } from "@/server/lib/link-creation/failures";
import { assertUrlSafe } from "@/server/lib/phishing";
import { checkCampaignPatternsAfterResponse } from "@/server/lib/phishing/rescan";
import { generateUnreservedAlias } from "@/server/lib/reserved-alias";
import { ServerTiming } from "@/server/lib/server-timing";
import { reserveMonthlyLinkSlot } from "@/server/lib/user-plan";

import { apiDomainWriteError, resolveApiDomainForUser, toApiLink } from "../utils";

import type { ApiToken } from "../utils";
import type { Plan } from "@/lib/billing/plans";
import type { LinkCreationAttempt, LinkCreationSource } from "@/server/lib/link-creation/failures";

export const shortenLinkSchema = z.object({
  url: destinationUrlSchema,
  expiresAt: z.string().optional(),
  activatesAt: z.string().datetime({ offset: true }).optional(),
  expiresAfter: z.number().optional(),
  alias: linkAliasSchema.optional(),
  password: z.string().optional(),
  domain: linkDomainSchema.optional(),
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

export type ShortenLinkInput = z.infer<typeof shortenLinkSchema>;

/**
 * Creates a link in the token owner's personal workspace with the plan's checks, the URL safety
 * check and the monthly quota. Shared by POST /api/v1/links and the browser extension. Throws
 * TRPCErrors with user-facing messages; plan refusals are FORBIDDEN. Step durations go to
 * `serverTiming` for the route's Server-Timing header.
 */
export async function createTokenLink(
  token: ApiToken,
  parsedData: ShortenLinkInput,
  source: LinkCreationSource,
  serverTiming = new ServerTiming(),
) {
  return trackLinkCreation(db, source, token.userId, async (attempt) => {
    const { requestedDomain, domainError } = await serverTiming.measure("domain", async () => {
      const domain = await resolveApiDomainForUser(token.userId, parsedData);
      return {
        requestedDomain: domain,
        domainError:
          domain && (await apiDomainWriteError(token.userId, token.graceUsagePlan, domain)),
      };
    });
    if (!requestedDomain) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message:
          source === "api"
            ? "Domain not available for this API key"
            : "Domain not available for this account",
      });
    }
    const plan = token.plan;
    if (domainError) {
      throw new TRPCError({ code: "FORBIDDEN", message: domainError });
    }
    if (parsedData.activatesAt && plan === "free") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Scheduled links are only available on Pro and Ultra plans",
      });
    }
    const alias = parsedData.alias;
    if (alias) {
      await serverTiming.measure("alias", () =>
        validateAlias({ db }, alias, requestedDomain, plan !== "free"),
      );
    }
    return createNewLink(parsedData, token.userId, plan, requestedDomain, attempt, serverTiming);
  });
}

async function createNewLink(
  data: ShortenLinkInput,
  userId: string,
  plan: Plan,
  domain: string,
  attempt: LinkCreationAttempt,
  serverTiming: ServerTiming,
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
  // The alias lookup doesn't depend on the safety verdict, so it runs alongside it.
  const [, alias] = await Promise.all([
    assertUrlSafe(data.url, {}, serverTiming),
    data.alias ?? serverTiming.measure("alias", () => generateUnreservedAlias(db, domain)),
  ]);

  attempt.step = "db";

  const newLinkData = {
    url: data.url,
    alias,
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
  const newLinkId = await serverTiming.measure("db", () =>
    db.transaction(async (tx) => {
      const { userRecord } = await reserveMonthlyLinkSlot(userId, tx);
      const newLink = await tx
        .insert(link)
        .values({ ...newLinkData, ...restrictedLinkValues(userRecord.restrictedAt) });
      return newLink[0].insertId;
    }),
  );
  checkCampaignPatternsAfterResponse([{ linkId: newLinkId, url: data.url }]);

  const [retrievedLink] = await serverTiming.measure("read", () =>
    db.select().from(link).where(eq(link.id, newLinkId)),
  );
  return { ...toApiLink(retrievedLink!), isProtected: !!retrievedLink!.passwordHash };
}
