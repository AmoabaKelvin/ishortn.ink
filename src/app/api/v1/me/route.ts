import { eq } from "drizzle-orm";

import { getApiRateLimits, getPlanCaps } from "@/lib/billing/plans";
import { db } from "@/server/db";
import { user } from "@/server/db/schema";
import { linksUsedThisMonth } from "@/server/lib/user-plan";

import { apiError } from "../errors";
import { getUserDefaultDomain, withApiKey } from "../utils";

export const GET = withApiKey(async (_request: Request, token) => {
  const [owner, defaultDomain] = await Promise.all([
    db.query.user.findFirst({
      where: eq(user.id, token.userId),
      columns: { id: true, email: true, name: true },
    }),
    getUserDefaultDomain(token.userId),
  ]);
  // withApiKey already loaded this user; only a delete racing the request lands here.
  if (!owner) return apiError(401, "unauthorized", "Invalid or missing API key");

  return Response.json({
    id: owner.id,
    email: owner.email,
    name: owner.name,
    plan: token.plan,
    defaultDomain,
    // The token row already carries the counter, so usage costs no extra query.
    usage: {
      linksThisMonth: linksUsedThisMonth(token.owner),
      linksLimit: getPlanCaps(token.plan).linksLimit ?? null,
    },
    rateLimits: getApiRateLimits(token.plan),
  });
});
