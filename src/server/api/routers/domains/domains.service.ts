import { TRPCError } from "@trpc/server";
import { and, count, eq, inArray } from "drizzle-orm";

import { customDomain, link, linkVisit } from "@/server/db/schema";
import {
  requirePermission,
  workspaceFilter,
  workspaceOwnership,
} from "@/server/lib/workspace";

import { addDomainToVercelProject, deleteDomainFromVercelProject, getDomainFromVercelProject } from "./utils";

import type { WorkspaceTRPCContext } from "../../trpc";
import type { CreateCustomDomainInput } from "./domains.input";
import type { VercelConfigResponse } from "./domains.procedure";

export async function addDomainToUserAccount(
  ctx: WorkspaceTRPCContext,
  input: CreateCustomDomainInput,
) {
  // Check permission for domain creation (owners and admins only in team workspaces)
  requirePermission(ctx.workspace, "domains.create", "add custom domains");

  const userId = ctx.auth.userId;

  const userSubscription = await ctx.db.query.subscription.findFirst({
    where: (table, { eq }) => eq(table.userId, userId),
  });

  if (!userSubscription || userSubscription.status !== "active") {
    throw new Error("You need to have an active subscription to add a custom domain");
  }

  // remove http, https, and www. from the domain
  const domain = input.domain.replace("http://", "").replace("https://", "").replace("www.", "");

  const ownership = workspaceOwnership(ctx.workspace);

  // Check if the domain already exists in the current workspace
  const existingDomainInWorkspace = await ctx.db.query.customDomain.findFirst({
    where: and(
      eq(customDomain.domain, domain),
      workspaceFilter(ctx.workspace, customDomain.userId, customDomain.teamId)
    ),
  });

  if (existingDomainInWorkspace) {
    throw new Error("This domain is already added to this workspace");
  }

  try {
    const response = await addDomainToVercelProject(domain);

    // If domain already exists in Vercel (added by another workspace), get its current config
    if (response.alreadyExists) {
      const existingVercelDomain = await getDomainFromVercelProject(domain);

      if (!existingVercelDomain) {
        throw new Error("Failed to retrieve domain configuration");
      }

      // Check if it's properly configured
      const configResponse = await fetch(
        `https://api.vercel.com/v6/domains/${domain}/config?teamId=${process.env.TEAM_ID_VERCEL}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${process.env.AUTH_BEARER_TOKEN}`,
            "Content-Type": "application/json",
          },
        },
      );

      const configData = (await configResponse.json()) as VercelConfigResponse;
      const wellConfigured = existingVercelDomain.verified && !configData.misconfigured;

      // Get verification details from existing domain
      const verificationDetails = existingVercelDomain.verification?.map((challenge) => {
        if (challenge.type === "TXT") {
          return {
            type: challenge.type,
            domain: "_vercel",
            value: challenge.value,
          };
        }
        return challenge;
      }) ?? [];

      await ctx.db.insert(customDomain).values({
        userId: ownership.userId,
        teamId: ownership.teamId,
        domain: domain,
        status: wellConfigured ? "active" : "pending",
        verificationDetails: verificationDetails,
      });

      return { success: true };
    }

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

    let wellConfigured = false;

    if (response.verified) {
      // the domain is verified so let's check if it's misconfigured
      const configResponse = await fetch(
        `https://api.vercel.com/v6/domains/${domain}/config?teamId=${process.env.TEAM_ID_VERCEL}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${process.env.AUTH_BEARER_TOKEN}`,
            "Content-Type": "application/json",
          },
        },
      );

      const data = (await configResponse.json()) as VercelConfigResponse;
      wellConfigured = !data.misconfigured;
    }

    await ctx.db.insert(customDomain).values({
      userId: ownership.userId,
      teamId: ownership.teamId,
      domain: domain,
      status: wellConfigured ? "active" : "pending",
      verificationDetails: verificationDetails,
    });
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to add domain to Vercel project");
  }

  return { success: true };
}

export async function getCustomDomainsForUser(ctx: WorkspaceTRPCContext) {
  const customDomains = await ctx.db.query.customDomain.findMany({
    where: workspaceFilter(ctx.workspace, customDomain.userId, customDomain.teamId),
  });

  return customDomains;
}

export async function deleteDomainAndAssociatedLinks(ctx: WorkspaceTRPCContext, domainId: number) {
  // Check permission for domain deletion (owners and admins only in team workspaces)
  requirePermission(ctx.workspace, "domains.delete", "delete custom domains");

  const domain = await ctx.db.query.customDomain.findFirst({
    where: and(
      eq(customDomain.id, domainId),
      workspaceFilter(ctx.workspace, customDomain.userId, customDomain.teamId)
    ),
  });

  if (!domain) {
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
      .where(and(eq(link.domain, domain.domain!), workspaceFilter(ctx.workspace, link.userId, link.teamId)));

    const linkIds = linksToDelete.map((link) => link.id);

    // delete all link visits
    if (linkIds.length > 0) {
      await tx.delete(linkVisit).where(inArray(linkVisit.linkId, linkIds));
    }

    // delete all links
    await tx.delete(link).where(and(eq(link.domain, domain.domain!), workspaceFilter(ctx.workspace, link.userId, link.teamId)));

    // Delete the domain itself
    await tx.delete(customDomain).where(eq(customDomain.id, domainId));

    // Only delete from Vercel if no other workspaces are using this domain
    const otherWorkspacesUsingDomain = await tx.query.customDomain.findFirst({
      where: eq(customDomain.domain, domain.domain!),
    });

    if (!otherWorkspacesUsingDomain) {
      await deleteDomainFromVercelProject(domain.domain!);
    }

    return { success: true, message: "Domain and associated links deleted successfully" };
  });
}

export async function getDomainStatistics(ctx: WorkspaceTRPCContext, domain: string) {
  // Get all links for this domain in the current workspace
  const domainLinks = await ctx.db
    .select({
      id: link.id,
      createdAt: link.createdAt,
    })
    .from(link)
    .where(and(eq(link.domain, domain), workspaceFilter(ctx.workspace, link.userId, link.teamId)));

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
