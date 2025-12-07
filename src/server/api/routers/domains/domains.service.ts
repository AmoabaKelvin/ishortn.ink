import { TRPCError } from "@trpc/server";
import { count, eq, inArray, sql } from "drizzle-orm";

import { customDomain, link, linkVisit } from "@/server/db/schema";

import { addDomainToVercelProject, deleteDomainFromVercelProject } from "./utils";

import type { ProtectedTRPCContext } from "../../trpc";
import type { CreateCustomDomainInput } from "./domains.input";
import type { VercelConfigResponse } from "./domains.procedure";
export async function addDomainToUserAccount(
  ctx: ProtectedTRPCContext,
  input: CreateCustomDomainInput,
) {
  const userId = ctx.auth.userId;

  const userSubscription = await ctx.db.query.subscription.findFirst({
    where: (table, { eq }) => eq(table.userId, userId),
  });

  if (!userSubscription || userSubscription.status !== "active") {
    throw new Error("You need to have an active subscription to add a custom domain");
  }

  // check if the domain is already existing
  const existingDomain = await ctx.db.query.customDomain.findFirst({
    where: (table, { eq }) => eq(table.domain, input.domain),
  });

  if (existingDomain) {
    throw new Error("This domain is already in use");
  }

  // remove http, https, and www. from the domain
  const domain = input.domain.replace("http://", "").replace("https://", "").replace("www.", "");

  try {
    const response = await addDomainToVercelProject(domain);

    const verificationChallenges = response.verificationChallenges;

    // for a verification challenge that has a type of "TXT", change the domain to be just
    // _vercel

    const verificationDetails = verificationChallenges.map((challenge) => {
      if (challenge.type === "TXT") {
        return {
          type: challenge.type,
          domain: "_vercel",
          value: challenge.value,
        };
      }

      return challenge;
    });

    // biome-ignore lint/suspicious/noImplicitAnyLet: <explanation>
    let wellConfigured;

    if (response.verified) {
      // the domain is verified so let's check if it's misconfigured
      const response = await fetch(
        `https://api.vercel.com/v6/domains/${domain}/config?teamId=${process.env.TEAM_ID_VERCEL}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${process.env.AUTH_BEARER_TOKEN}`,
            "Content-Type": "application/json",
          },
        },
      );

      const data = (await response.json()) as VercelConfigResponse;

      if (data.misconfigured) {
        wellConfigured = false;
      } else {
        wellConfigured = true;
      }
    }

    await ctx.db.insert(customDomain).values({
      userId,
      domain: domain,
      status: wellConfigured ? "active" : "pending",
      verificationDetails: verificationDetails,
    });
  } catch (_error) {
    throw new Error("Failed to add domain to Vercel project");
  }

  return { success: true };
}

export async function getCustomDomainsForUser(ctx: ProtectedTRPCContext) {
  const userId = ctx.auth.userId;

  const customDomains = await ctx.db.query.customDomain.findMany({
    where: (table, { eq }) => eq(table.userId, userId),
  });

  return customDomains;
}

export async function deleteDomainAndAssociatedLinks(ctx: ProtectedTRPCContext, domainId: number) {
  const domain = await ctx.db.query.customDomain.findFirst({
    where: (table, { eq }) => eq(table.id, domainId),
  });

  if (!domain || domain.userId !== ctx.auth.userId) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Domain not found or you don't have permission to delete it",
    });
  }

  // Start a transaction to ensure all operations succeed or fail together
  return await ctx.db.transaction(async (tx) => {
    // Delete all links associated with this domain
    // await tx.delete(link).where(eq(link.domain, domain.domain!));

    const linksToDelete = await tx
      .select({ id: link.id })
      .from(link)
      .where(eq(link.domain, domain.domain!));

    const linkIds = linksToDelete.map((link) => link.id);

    // delete all link visits
    if (linkIds.length > 0) {
      await tx.delete(linkVisit).where(inArray(linkVisit.linkId, linkIds));
    }

    // delete all links
    await tx.delete(link).where(eq(link.domain, domain.domain!));

    // Delete the domain itself
    await tx.delete(customDomain).where(eq(customDomain.id, domainId));

    await deleteDomainFromVercelProject(domain.domain!);

    return { success: true, message: "Domain and associated links deleted successfully" };
  });
}

export async function getDomainStatistics(ctx: ProtectedTRPCContext, domain: string) {
  // Get all links for this domain
  const domainLinks = await ctx.db
    .select({
      id: link.id,
      createdAt: link.createdAt,
    })
    .from(link)
    .where(eq(link.domain, domain));

  const linkIds = domainLinks.map((l) => l.id);

  // Calculate link count
  const linkCount = domainLinks.length;

  // Calculate total clicks
  let totalClicks = 0;
  if (linkIds.length > 0) {
    const clicksResult = await ctx.db
      .select({ count: count() })
      .from(linkVisit)
      .where(inArray(linkVisit.linkId, linkIds));

    totalClicks = clicksResult[0]?.count ?? 0;
  }

  // Find last used date (most recent link creation)
  const lastUsedAt = domainLinks.length > 0
    ? domainLinks.reduce((latest, current) => {
        const currentDate = current.createdAt ? new Date(current.createdAt) : null;
        if (!currentDate) return latest;
        if (!latest) return currentDate;
        return currentDate > latest ? currentDate : latest;
      }, null as Date | null)
    : null;

  return {
    linkCount,
    totalClicks,
    lastUsedAt,
  };
}
