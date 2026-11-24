import { and, eq, isNull } from "drizzle-orm";

import { getPlanCaps } from "@/lib/billing/plans";
import { PLATFORM_DOMAINS } from "@/lib/constants/domains";
import { EXTENSION_UPGRADE_URL } from "@/lib/extension/connect";
import { getUsableCustomDomains } from "@/server/api/routers/link/utils";
import { db } from "@/server/db";
import { customDomain, user } from "@/server/db/schema";
import { linksUsedThisMonth } from "@/server/lib/user-plan";

import { getUserDefaultDomain } from "../../v1/utils";
import { extensionError, extensionPreflight, withExtensionToken } from "../auth";

import type { Plan } from "@/lib/billing/plans";

export const OPTIONS = extensionPreflight;

/** The active personal custom domains new links can use on this plan (see apiDomainWriteError). */
async function writableCustomDomains(userId: string, plan: Plan): Promise<string[]> {
  const limit = getPlanCaps(plan).domainLimit;
  const scope = and(eq(customDomain.userId, userId), isNull(customDomain.teamId));
  const [active, usable] = await Promise.all([
    db
      .select({ domain: customDomain.domain })
      .from(customDomain)
      .where(and(scope, eq(customDomain.status, "active"))),
    limit === undefined ? null : getUsableCustomDomains(db, scope, limit),
  ]);
  return active
    .flatMap((row) => (row.domain ? [row.domain.toLowerCase()] : []))
    .filter((domain) => !usable || usable.includes(domain));
}

export const GET = withExtensionToken(async (_request: Request, token) => {
  const [owner, defaultDomain, customDomains] = await Promise.all([
    db.query.user.findFirst({
      where: eq(user.id, token.userId),
      columns: { email: true, monthlyLinkCount: true, lastLinkCountReset: true, createdAt: true },
    }),
    getUserDefaultDomain(token.userId),
    writableCustomDomains(token.userId, token.graceUsagePlan),
  ]);
  // The wrapper already loaded this user; only a delete racing the request lands here.
  if (!owner) return extensionError(401, "Not connected. Connect the extension again.");

  const domains = [...PLATFORM_DOMAINS, ...customDomains];
  // A default domain the plan no longer allows can't take new links; fall back to the platform's.
  const selected = domains.includes(defaultDomain) ? defaultDomain : domains[0];

  return Response.json({
    email: owner.email,
    plan: token.plan,
    linksUsedThisMonth: linksUsedThisMonth(owner),
    linksLimit: getPlanCaps(token.plan).linksLimit ?? null,
    domains: domains.map((domain) => ({ domain, isDefault: domain === selected })),
    upgradeUrl: EXTENSION_UPGRADE_URL,
  });
});
