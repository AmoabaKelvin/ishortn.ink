/**
 * Link Utility operations
 * Miscellaneous utilities for debugging and export
 */

import { workspaceFilter } from "@/server/lib/workspace";

import type { WorkspaceTRPCContext } from "../../../trpc";

export const exportAllUserLinks = async (ctx: WorkspaceTRPCContext) => {
  return ctx.db.query.link.findMany({
    columns: {
      url: true,
      alias: true,
      note: true,
      domain: true,
      createdAt: true,
    },
    where: (table) => workspaceFilter(ctx.workspace, table.userId, table.teamId),
  });
};

export const checkPresenceOfVercelHeaders = async (ctx: { headers: Headers }) => {
  return {
    headers: ctx.headers,
    countryHeader: ctx.headers.get("x-vercel-ip-country"),
    cityHeader: ctx.headers.get("x-vercel-ip-city"),
  };
};
