import crypto from "node:crypto";

import { retrieveDeviceAndGeolocationData } from "@/lib/core/analytics";
import { parseReferrer } from "@/lib/utils";
import { isBot } from "@/lib/utils/is-bot";
import { linkVisit, uniqueLinkVisit } from "@/server/db/schema";

import type { Link } from "@/server/db/schema";
import type { PublicTRPCContext } from "../../trpc";

export async function logAnalytics(ctx: PublicTRPCContext, link: Link, from: string) {
  if (link.passwordHash) {
    return;
  }

  if (from === "metadata") {
    return;
  }

  const userAgent = ctx.headers.get("user-agent");

  if (userAgent && isBot(userAgent)) {
    return;
  }

  const deviceDetails = await retrieveDeviceAndGeolocationData(ctx.headers);

  await ctx.db.insert(linkVisit).values({
    linkId: link.id,
    ...deviceDetails,
    referer: parseReferrer(ctx.headers.get("referer")),
  });

  const ipHash = crypto
    .createHash("sha256")
    .update(ctx.headers.get("x-forwarded-for") ?? "")
    .digest("hex");

  const existingLinkVisit = await ctx.db.query.uniqueLinkVisit.findFirst({
    where: (table, { eq, and }) => and(eq(table.linkId, link.id), eq(table.ipHash, ipHash)),
  });

  if (!existingLinkVisit) {
    await ctx.db.insert(uniqueLinkVisit).values({
      linkId: link.id,
      ipHash,
    });
  }
}
