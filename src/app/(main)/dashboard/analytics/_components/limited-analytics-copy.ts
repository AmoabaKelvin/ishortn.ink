import { PLAN_CAPS } from "@/lib/billing/plans";

const window = `last ${PLAN_CAPS.free.analyticsRangeLimitDays} days`;

/**
 * The Free analytics upgrade sentence, split around the inline "Upgrade to Pro" link. With clicks
 * older than the Free window it names how many; otherwise it keeps the generic line.
 */
export const limitedAnalyticsCopy = (hiddenClicks: number) => {
  if (hiddenClicks <= 0) {
    return { lead: `Viewing limited analytics (${window}).`, tail: "for full data." };
  }
  // A fixed locale so the server render and hydration format the count the same way.
  const count = hiddenClicks.toLocaleString("en-US");
  return hiddenClicks === 1
    ? { lead: `${count} older click is hidden on Free (${window} shown).`, tail: "to see it." }
    : {
        lead: `${count} older clicks are hidden on Free (${window} shown).`,
        tail: "to see all of them.",
      };
};
