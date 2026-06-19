import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";

import { runBackgroundTask } from "@/lib/utils/background";
import { flaggedLink, link } from "@/server/db/schema";
import { sendAbuseReportNotification } from "@/server/lib/notifications/discord";

import { createTRPCRouter, publicProcedure } from "../../trpc";
import { ABUSE_CATEGORY_LABELS, reportAbuseSchema } from "./abuse.input";

/**
 * Parse a user-submitted short link into a domain + alias pair.
 * Accepts forms like `https://ishortn.ink/abc`, `ishortn.ink/abc`,
 * `www.ishortn.ink/abc!`, with optional query/fragment.
 */
function parseShortUrl(raw: string): { domain: string; alias: string } | null {
  let s = raw.trim().replace(/^(https?:\/\/)?(www\.)?/i, "");
  s = s.split(/[?#]/)[0] ?? "";

  const slashIndex = s.indexOf("/");
  if (slashIndex === -1) return null;

  const domain = s.slice(0, slashIndex).toLowerCase();
  let alias = s.slice(slashIndex + 1).split("/")[0] ?? "";
  if (alias.endsWith("!")) alias = alias.slice(0, -1);

  if (!domain || !alias) return null;
  return { domain, alias: alias.toLowerCase() };
}

export const abuseRouter = createTRPCRouter({
  report: publicProcedure.input(reportAbuseSchema).mutation(async ({ ctx, input }) => {
    const parsed = parseShortUrl(input.shortUrl);
    if (!parsed) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "That doesn't look like a valid short link. Use a format like ishortn.ink/abc.",
      });
    }

    const reportedLink = await ctx.db.query.link.findFirst({
      where: and(
        sql`lower(${link.alias}) = lower(${parsed.alias})`,
        eq(link.domain, parsed.domain),
      ),
      columns: { id: true, url: true, domain: true, alias: true },
    });

    if (!reportedLink) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "We couldn't find that short link. Double-check the address and try again.",
      });
    }

    const reporterEmail = input.reporterEmail?.trim() || null;
    const details = input.details?.trim() || null;
    const categoryLabel = ABUSE_CATEGORY_LABELS[input.category];

    await ctx.db.insert(flaggedLink).values({
      linkId: reportedLink.id,
      reason: categoryLabel,
      reporterEmail,
      details,
      status: "pending",
    });

    void runBackgroundTask(
      sendAbuseReportNotification({
        shortUrl: `${reportedLink.domain}/${reportedLink.alias}`,
        destinationUrl: reportedLink.url,
        category: categoryLabel,
        reporterEmail,
        details,
      }),
    );

    return { success: true };
  }),
});
