import { and, eq, isNull } from "drizzle-orm";

import { getPlanCaps } from "@/lib/billing/plans";
import { PLATFORM_DOMAINS } from "@/lib/constants/domains";
import { EXTENSION_UPGRADE_URL } from "@/lib/extension/connect";
import { getUsableCustomDomains } from "@/server/api/routers/link/utils";
import { db } from "@/server/db";
import { customDomain } from "@/server/db/schema";
import { linksUsedThisMonth } from "@/server/lib/user-plan";

import { getUserDefaultDomain } from "../../v1/utils";
import { extensionPreflight, withExtensionToken } from "../auth";

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
  const [defaultDomain, customDomains] = await Promise.all([
    getUserDefaultDomain(token.userId),
    writableCustomDomains(token.userId, token.graceUsagePlan),
  ]);

  const domains = [...PLATFORM_DOMAINS, ...customDomains];
  // A default domain the plan no longer allows can't take new links; fall back to the platform's.
  const selected = domains.includes(defaultDomain) ? defaultDomain : domains[0];

  return Response.json({
    email: token.owner.email,
    plan: token.plan,
    linksUsedThisMonth: linksUsedThisMonth(token.owner),
    linksLimit: getPlanCaps(token.plan).linksLimit ?? null,
    domains: domains.map((domain) => ({ domain, isDefault: domain === selected })),
    upgradeUrl: EXTENSION_UPGRADE_URL,
  });
});
