import type { Plan } from "@/lib/billing/plans";
import {
  generateVisitId,
  signVerifiedClickToken,
} from "@/lib/utils/verified-click-token";

import { isOwnerOnPaidPlan } from "./user-plan";

export function assertCanEnableVerifiedClicks(plan: Plan): void {
  if (plan === "free") {
    throw new Error(
      "Verified clicks are only available on Pro and Ultra plans. Please upgrade to use this feature.",
    );
  }
}

/**
 * Returns null when the feature is off, the owner isn't paid, or the signing
 * secret isn't configured. Callers treat null as "record an ordinary click,
 * skip the beacon."
 */
export async function issueVerifiedClickToken(link: {
  userId: string;
  teamId: number | null;
  verifiedClicksEnabled: boolean | null;
}): Promise<{ visitId: string; verificationToken: string } | null> {
  if (!link.verifiedClicksEnabled) return null;
  if (!(await isOwnerOnPaidPlan(link.userId, link.teamId))) return null;

  const visitId = generateVisitId();
  const verificationToken = signVerifiedClickToken(visitId);
  if (!verificationToken) return null;

  return { visitId, verificationToken };
}
