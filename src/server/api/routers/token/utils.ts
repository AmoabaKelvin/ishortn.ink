import { TRPCError } from "@trpc/server";

import { canUseApi } from "@/lib/billing/api-access";
import { resolvePlan } from "@/lib/billing/plans";

import type { Subscription } from "@/server/db/schema";

/** Creating API keys needs Pro or Ultra at `now`; lapsed accounts can't either. */
export function assertCanCreateKeys(subscription: Subscription | null, now = new Date()) {
  if (!canUseApi(resolvePlan(subscription, now.getTime()))) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "API access is a Pro feature. Upgrade to Pro to create API keys.",
    });
  }
}
