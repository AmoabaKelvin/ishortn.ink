import type { SubmitAcquisitionInput } from "./audience-feedback.input";
import type { Plan } from "@/lib/billing/plans";

// "Not now" on the dashboard card hides it for 14 days, and it comes back at most once.
export const ACQUISITION_PROMPT_MAX_DISMISSALS = 2;
export const ACQUISITION_PROMPT_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;
// A "Not now" this recent also holds after checkout, so a plan change right after dismissing
// (often a second checkout on the same billing screen) doesn't ask again.
export const ACQUISITION_PROMPT_CHECKOUT_QUIET_MS = 24 * 60 * 60 * 1000;

type AcquisitionPromptRow = {
  submittedAt: Date | null;
  acquisitionAnsweredAt: Date | null;
  acquisitionDismissedAt: Date | null;
  acquisitionDismissCount: number;
};

export type AcquisitionPromptState = {
  plan: Plan;
  showOnDashboard: boolean;
  showAfterCheckout: boolean;
};

/**
 * Whether a paid account should be asked how it found iShortn. Free accounts never are (they
 * get the full survey). The full survey asks the same question, so submitting it counts as an
 * answer. Right after checkout the cooldown is skipped, as that is the moment worth asking at,
 * unless it was dismissed within the last day; the dismissal cap still applies.
 */
export function acquisitionPromptState(
  plan: Plan,
  row: AcquisitionPromptRow | null | undefined,
  now = new Date(),
): AcquisitionPromptState {
  const answered = Boolean(row?.acquisitionAnsweredAt ?? row?.submittedAt);
  const dismissCount = row?.acquisitionDismissCount ?? 0;
  const eligible = plan !== "free" && !answered && dismissCount < ACQUISITION_PROMPT_MAX_DISMISSALS;
  const dismissedAt = row?.acquisitionDismissedAt;
  const dismissedAgo = dismissedAt ? now.getTime() - dismissedAt.getTime() : Infinity;
  const cooledDown = dismissedAgo >= ACQUISITION_PROMPT_COOLDOWN_MS;

  return {
    plan,
    showOnDashboard: eligible && cooledDown,
    showAfterCheckout: eligible && dismissedAgo >= ACQUISITION_PROMPT_CHECKOUT_QUIET_MS,
  };
}

/**
 * Columns written for an acquisition answer. Only this answer's columns: the full survey's
 * answers and its submit/dismiss state stay as they are. A blank use case keeps any earlier one.
 */
export function acquisitionAnswerValues(
  input: SubmitAcquisitionInput,
  plan: Exclude<Plan, "free">,
  now: Date,
) {
  return {
    acquisitionChannel: input.acquisitionChannel,
    acquisitionDetail: input.acquisitionDetail || null,
    ...(input.useCase && { useCase: input.useCase }),
    planSnapshot: plan,
    acquisitionAnsweredAt: now,
  };
}
