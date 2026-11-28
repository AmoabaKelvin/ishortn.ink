import type { PlanGraceEmailProps } from "../plan-grace";

/**
 * The plan grace subject, also its headline: it states what happens and when. Kept out of the
 * template so grace.ts can build subjects without loading React.
 */
export function planGraceSubject(props: PlanGraceEmailProps): string {
  const { kind, reason, planName, endsOn, timeLeft, teamName, updatePaymentUrl } = props;
  if (reason === "team") {
    if (kind !== "started") return `${teamName} becomes read-only on ${endsOn}`;
    return updatePaymentUrl
      ? "Your iShortn Ultra payment didn't go through"
      : `${teamName} needs Ultra to stay editable after ${endsOn}`;
  }
  if (kind === "ended") return "Your iShortn account is on the Free plan now";
  if (updatePaymentUrl) {
    return kind === "started"
      ? `Your iShortn ${planName} payment didn't go through`
      : `Update your card by ${endsOn} to keep ${planName}`;
  }
  return kind === "started"
    ? `Keep your ${planName} features after ${endsOn}`
    : `${timeLeft} left to keep your ${planName} features`;
}
