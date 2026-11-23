import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, lte } from "drizzle-orm";

import { parseCustomRange, resolveRangeWindow } from "@/lib/core/analytics";
import { link, linkVisit } from "@/server/db/schema";
import { workspaceFilter } from "@/server/lib/workspace";

import { clicksToCsv, MAX_CLICK_EXPORT_ROWS, overviewLinkConditions } from "./utils";

import type { WorkspaceTRPCContext } from "../../trpc";
import type { ExportClicksInput } from "./link.input";

/**
 * Raw clicks in the selected analytics range as CSV, newest first, capped at
 * MAX_CLICK_EXPORT_ROWS. Clicks past the retention window survive only as daily
 * totals, so they are not in the export.
 */
export const exportClicks = async (ctx: WorkspaceTRPCContext, input: ExportClicksInput) => {
  if (ctx.workspace.plan === "free") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Exporting clicks is available on the Pro and Ultra plans.",
    });
  }

  let linkScope;
  if (input.link) {
    const found = await ctx.db.query.link.findFirst({
      columns: { id: true },
      where: and(
        eq(link.alias, input.link.alias),
        eq(link.domain, input.link.domain),
        workspaceFilter(ctx.workspace, link.userId, link.teamId),
      ),
    });
    if (!found) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Link not found" });
    }
    linkScope = [eq(link.id, found.id)];
  } else {
    linkScope = overviewLinkConditions(ctx.workspace, input);
  }

  const window = resolveRangeWindow(
    input.range,
    new Date(),
    parseCustomRange(input.from, input.to),
  );
  const rows = await ctx.db
    .select({
      createdAt: linkVisit.createdAt,
      domain: link.domain,
      alias: link.alias,
      url: link.url,
      country: linkVisit.country,
      city: linkVisit.city,
      device: linkVisit.device,
      browser: linkVisit.browser,
      os: linkVisit.os,
      referer: linkVisit.referer,
    })
    .from(linkVisit)
    .innerJoin(link, eq(link.id, linkVisit.linkId))
    .where(
      and(
        ...linkScope,
        window.from ? gte(linkVisit.createdAt, window.from) : undefined,
        lte(linkVisit.createdAt, window.to),
      ),
    )
    .orderBy(desc(linkVisit.createdAt), desc(linkVisit.id))
    // One extra row tells a range that hit the cap from one that fits exactly.
    .limit(MAX_CLICK_EXPORT_ROWS + 1);

  const truncated = rows.length > MAX_CLICK_EXPORT_ROWS;
  const exported = truncated ? rows.slice(0, MAX_CLICK_EXPORT_ROWS) : rows;

  return {
    csv: clicksToCsv(exported),
    rowCount: exported.length,
    truncated,
    range: input.range,
  };
};
