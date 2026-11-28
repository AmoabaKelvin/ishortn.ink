import { and, count, eq, gte } from "drizzle-orm";

import { getApiRateLimits, getPlanCaps } from "@/lib/billing/plans";
import { db } from "@/server/db";
import { link, user } from "@/server/db/schema";
import { getMonthStart, linksUsedThisMonth } from "@/server/lib/user-plan";

import { apiError } from "../errors";
import { withApiKey } from "../utils";

import type { ApiToken } from "../utils";

/** Team links have no monthly quota (teams are on Ultra), so they're counted only here. */
async function linksThisMonth(token: ApiToken) {
  if (!token.team) return linksUsedThisMonth(token.owner);
  const [row] = await db
    .select({ count: count() })
    .from(link)
    .where(and(eq(link.teamId, token.team.id), gte(link.createdAt, getMonthStart())));
  return row?.count ?? 0;
}

export const GET = withApiKey(async (_request: Request, token) => {
  const [keyUser, usedThisMonth] = await Promise.all([
    db.query.user.findFirst({
      where: eq(user.id, token.userId),
      columns: { id: true, email: true, name: true },
    }),
    linksThisMonth(token),
  ]);
  // withApiKey already loaded this user; only a delete racing the request lands here. Team
  // keys outlive their creator's account, so theirs reports the creator's id alone.
  if (!keyUser && !token.team) return apiError(401, "unauthorized", "Invalid or missing API key");

  return Response.json({
    // The key's creator; on a team key, `workspace` names the team the key acts in.
    id: token.userId,
    email: keyUser?.email ?? null,
    name: keyUser?.name ?? null,
    plan: token.plan,
    workspace: token.workspace,
    // Resolved with the token, so it costs no extra query.
    defaultDomain: token.defaultDomain,
    usage: {
      linksThisMonth: usedThisMonth,
      linksLimit: getPlanCaps(token.plan).linksLimit ?? null,
    },
    rateLimits: getApiRateLimits(token.plan),
  });
});
