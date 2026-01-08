/**
 * Link Analytics operations
 * Handles visit tracking, statistics, and analytics aggregation
 */

import { and, count, eq } from "drizzle-orm";

import { link, linkVisit, uniqueLinkVisit } from "@/server/db/schema";
import { workspaceFilter } from "@/server/lib/workspace";

import { getDateRangeFromFilter } from "./link-shared";

import type { WorkspaceTRPCContext } from "../../../trpc";

export const getLinkVisits = async (
  ctx: WorkspaceTRPCContext,
  input: { id: string; domain: string; range: string }
) => {
  // Use workspace plan - team workspaces inherit Ultra features
  const plan = ctx.workspace.plan;
  const userHasPaidPlan = plan !== "free";

  // Use workspace filtering to ensure the link belongs to the current workspace
  const foundLink = await ctx.db.query.link.findFirst({
    where: and(
      eq(link.alias, input.id),
      eq(link.domain, input.domain),
      workspaceFilter(ctx.workspace, link.userId, link.teamId)
    ),
  });

  if (!foundLink) {
    return {
      totalVisits: [],
      uniqueVisits: [],
      topCountry: "N/A",
      referers: {},
      topReferrer: "N/A",
      isProPlan: userHasPaidPlan,
    };
  }

  const { startDate, endDate } = getDateRangeFromFilter(input.range, userHasPaidPlan);

  const [totalVisits, uniqueVisits] = await Promise.all([
    ctx.db.query.linkVisit.findMany({
      where: (visit, { eq, and, gte, lte }) =>
        and(
          eq(visit.linkId, foundLink.id),
          gte(visit.createdAt, startDate),
          lte(visit.createdAt, endDate)
        ),
    }),
    ctx.db.query.uniqueLinkVisit.findMany({
      where: (visit, { eq, and, gte, lte }) =>
        and(
          eq(visit.linkId, foundLink.id),
          gte(visit.createdAt, startDate),
          lte(visit.createdAt, endDate)
        ),
    }),
  ]);

  if (totalVisits.length === 0) {
    return {
      totalVisits: [],
      uniqueVisits: [],
      topCountry: "N/A",
      referers: {},
      topReferrer: "N/A",
      isProPlan: userHasPaidPlan,
    };
  }

  const countryVisits = totalVisits.reduce((acc, visit) => {
    acc[visit.country!] = (acc[visit.country!] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const topCountry = Object.entries(countryVisits).reduce(
    (a, b) => (a[1] > b[1] ? a : b),
    ["", 0]
  )[0];

  const referrerVisits = totalVisits.reduce((acc, visit) => {
    acc[visit.referer!] = (acc[visit.referer!] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const topReferrer = Object.entries(referrerVisits).reduce(
    (a, b) => (a[1] > b[1] ? a : b),
    ["", 0]
  )[0];

  return {
    totalVisits,
    uniqueVisits,
    topCountry,
    referers: referrerVisits,
    topReferrer: topReferrer !== "null" ? topReferrer : "Direct",
    isProPlan: userHasPaidPlan,
  };
};

export const getAllUserAnalytics = async (
  ctx: WorkspaceTRPCContext,
  input: { range: string; filterType: "all" | "folder" | "domain" | "link"; filterId?: string | number }
) => {
  // Use workspace plan - team workspaces inherit Ultra features
  const plan = ctx.workspace.plan;
  const userHasPaidPlan = plan !== "free";

  // Fetch workspace links with optional filtering
  const userLinks = await ctx.db.query.link.findMany({
    where: (table, { eq, and, isNull }) => {
      const conditions = [workspaceFilter(ctx.workspace, table.userId, table.teamId)];

      // Apply filter based on type
      if (input.filterType === "folder" && input.filterId !== undefined) {
        if (input.filterId === "null" || input.filterId === null) {
          conditions.push(isNull(table.folderId));
        } else {
          conditions.push(eq(table.folderId, Number(input.filterId)));
        }
      } else if (input.filterType === "domain" && input.filterId) {
        conditions.push(eq(table.domain, String(input.filterId)));
      } else if (input.filterType === "link" && input.filterId) {
        conditions.push(eq(table.id, Number(input.filterId)));
      }

      return and(...conditions);
    },
  });

  if (userLinks.length === 0) {
    return {
      totalVisits: [],
      uniqueVisits: [],
      topCountry: "N/A",
      referers: {},
      topReferrer: "N/A",
      isProPlan: userHasPaidPlan,
      clicksByLink: {},
      clicksByDestination: {},
    };
  }

  const { startDate, endDate } = getDateRangeFromFilter(input.range, userHasPaidPlan);
  const linkIds = userLinks.map((l) => l.id);

  // Fetch all visits for all links
  const [totalVisits, uniqueVisits] = await Promise.all([
    ctx.db.query.linkVisit.findMany({
      where: (visit, { inArray, and, gte, lte }) =>
        and(
          inArray(visit.linkId, linkIds),
          gte(visit.createdAt, startDate),
          lte(visit.createdAt, endDate)
        ),
    }),
    ctx.db.query.uniqueLinkVisit.findMany({
      where: (visit, { inArray, and, gte, lte }) =>
        and(
          inArray(visit.linkId, linkIds),
          gte(visit.createdAt, startDate),
          lte(visit.createdAt, endDate)
        ),
    }),
  ]);

  if (totalVisits.length === 0) {
    return {
      totalVisits: [],
      uniqueVisits: [],
      topCountry: "N/A",
      referers: {},
      topReferrer: "N/A",
      isProPlan: userHasPaidPlan,
      clicksByLink: {},
      clicksByDestination: {},
    };
  }

  // Aggregate clicks by link
  const clicksByLink: Record<string, number> = {};
  const clicksByDestination: Record<string, number> = {};
  const linkIdToInfo = new Map(
    userLinks.map((l) => [
      l.id,
      { shortLink: `${l.domain}/${l.alias}`, destination: l.url },
    ])
  );

  totalVisits.forEach((visit) => {
    const linkInfo = linkIdToInfo.get(visit.linkId);
    if (linkInfo) {
      clicksByLink[linkInfo.shortLink] =
        (clicksByLink[linkInfo.shortLink] ?? 0) + 1;
      if (linkInfo.destination) {
        clicksByDestination[linkInfo.destination] =
          (clicksByDestination[linkInfo.destination] ?? 0) + 1;
      }
    }
  });

  // Calculate top country
  const countryVisits = totalVisits.reduce((acc, visit) => {
    if (visit.country) {
      acc[visit.country] = (acc[visit.country] ?? 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);
  const topCountry =
    Object.entries(countryVisits).length > 0
      ? Object.entries(countryVisits).reduce((a, b) => (a[1] > b[1] ? a : b))[0]
      : "N/A";

  // Calculate referrers
  const referrerVisits = totalVisits.reduce((acc, visit) => {
    const ref = visit.referer ?? "null";
    acc[ref] = (acc[ref] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const topReferrer =
    Object.entries(referrerVisits).length > 0
      ? Object.entries(referrerVisits).reduce((a, b) =>
          a[1] > b[1] ? a : b
        )[0]
      : "null";

  return {
    totalVisits,
    uniqueVisits,
    topCountry,
    referers: referrerVisits,
    topReferrer: topReferrer !== "null" ? topReferrer : "Direct",
    isProPlan: userHasPaidPlan,
    clicksByLink,
    clicksByDestination,
  };
};

export const getStats = async (ctx: WorkspaceTRPCContext) => {
  const [totalLinksResult, activeLinksResult] = await Promise.all([
    ctx.db
      .select({ count: count() })
      .from(link)
      .where(workspaceFilter(ctx.workspace, link.userId, link.teamId)),
    ctx.db
      .select({ count: count() })
      .from(link)
      .where(and(workspaceFilter(ctx.workspace, link.userId, link.teamId), eq(link.archived, false))),
  ]);

  return {
    totalLinks: totalLinksResult?.[0]?.count ?? 0,
    activeLinks: activeLinksResult?.[0]?.count ?? 0,
  };
};

export const resetLinkStatistics = async (
  ctx: WorkspaceTRPCContext,
  input: { id: number }
) => {
  const fetchedLink = await ctx.db.query.link.findFirst({
    where: and(
      eq(link.id, input.id),
      workspaceFilter(ctx.workspace, link.userId, link.teamId)
    ),
  });

  if (!fetchedLink) {
    return null;
  }

  await ctx.db.delete(linkVisit).where(eq(linkVisit.linkId, fetchedLink.id));
  await ctx.db.delete(uniqueLinkVisit).where(eq(uniqueLinkVisit.linkId, fetchedLink.id));

  return fetchedLink;
};
