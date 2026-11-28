import { nextPlanFor } from "./upgrade";

import type { Plan } from "./plans";
import type { UpgradePlan } from "./upgrade";

/**
 * The plan that lifts a server plan-limit rejection. Messages that name only
 * Ultra ("…on the Ultra plan", "Upgrade to Ultra for unlimited…") need Ultra;
 * everything else is lifted by the next plan above the user's current one.
 */
export function requiredPlanForLimit(message: string, currentPlan: Plan = "free"): UpgradePlan {
  if (/\bultra\b/i.test(message) && !/\bpro\b/i.test(message)) return "ultra";
  return nextPlanFor(currentPlan);
}

type MaybePlanLimitError = { message: string; data?: { code?: string } | null };

/** A FORBIDDEN error whose message is a plan gate ("…Upgrade…", "…available on Pro…"). */
export function isPlanLimitError(error: MaybePlanLimitError): boolean {
  return error.data?.code === "FORBIDDEN" && /upgrade|available on/i.test(error.message);
}

/** Upgrade source for a plan rejection on link edit, from the gate named in the message. */
export function linkEditLimitSource(message: string): string {
  if (/targeting rule/i.test(message)) return "geo_rules";
  if (/milestone/i.test(message)) return "milestones";
  if (/password/i.test(message)) return "link_password";
  if (/schedul/i.test(message)) return "link_schedule";
  return "link_edit";
}

/**
 * The `limit_key` analytics property for a plan rejection, from the gate named in its message
 * (the server's messages are the only signal the client and the extension route both get).
 */
export function planLimitKey(message: string): string {
  if (/monthly limit of .* links/i.test(message)) return "monthly_links";
  if (/email reports/i.test(message)) return "scheduled_reports";
  if (/domain/i.test(message)) return "custom_domain";
  if (/password/i.test(message)) return "password";
  if (/\butm\b/i.test(message)) return "utm";
  if (/schedul/i.test(message)) return "scheduling";
  if (/targeting rule/i.test(message)) return "geo_rules";
  if (/milestone/i.test(message)) return "milestones";
  if (/cloaking/i.test(message)) return "cloaking";
  if (/social media preview/i.test(message)) return "social_preview";
  if (/qr code/i.test(message)) return "qr_codes";
  if (/embed block/i.test(message)) return "bio_embed_blocks";
  if (/email signup block/i.test(message)) return "bio_email_capture_blocks";
  if (/image block/i.test(message)) return "bio_image_blocks";
  return "other";
}
