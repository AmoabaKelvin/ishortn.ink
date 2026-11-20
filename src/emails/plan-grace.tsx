import { Section, Text } from "@react-email/components";

import {
  CodeBlock,
  EmailButton,
  EmailLayout,
  panel,
  panelItem,
  Signoff,
  smallText,
  text,
} from "./_components/layout";

export type PlanGraceEmailProps = {
  recipientName?: string | null;
  kind: "started" | "reminder" | "ended";
  /** lapsed: the subscription ended; over_plan: features above the plan; team: owner not on Ultra. */
  reason: "lapsed" | "over_plan" | "team";
  /** The plan that keeps everything working. */
  planName: string;
  endsOn: string;
  timeLeft: string;
  teamName?: string;
  /** What stops being available (already phrased). */
  items: string[];
  upgradeUrl: string;
};

function intro({ kind, reason, planName, endsOn, timeLeft, teamName }: PlanGraceEmailProps) {
  if (reason === "team") {
    return kind === "started"
      ? `Team workspaces are part of the Ultra plan, and the owner of ${teamName} isn't on Ultra right now. The team keeps working as usual until ${endsOn}. After that it becomes read-only for every member: no new links, domains, edits or invites.`
      : `${timeLeft} left: on ${endsOn}, ${teamName} becomes read-only for every member (no new links, domains, edits or invites) unless its owner is on Ultra.`;
  }
  if (reason === "lapsed") {
    if (kind === "ended") {
      return `Your ${planName} access has ended and your account is on the Free plan now. These features can't be added or changed any more:`;
    }
    return kind === "started"
      ? `Your iShortn ${planName} subscription has ended or its last payment didn't go through. You keep ${planName} until ${endsOn}. After that, Free plan limits apply:`
      : `${timeLeft} left: your ${planName} access ends on ${endsOn}. After that, Free plan limits apply:`;
  }
  return kind === "started"
    ? `Your account uses features that aren't part of your current plan. They keep working as they are until ${endsOn}. After that they can't be added or changed:`
    : `${timeLeft} left: from ${endsOn}, these features can't be added or changed on your current plan:`;
}

export const PlanGraceEmail = (props: PlanGraceEmailProps) => {
  const { recipientName, kind, reason, planName, items, upgradeUrl } = props;

  return (
    <EmailLayout
      preview={
        reason === "team"
          ? `${props.teamName} needs its owner on Ultra`
          : kind === "ended"
            ? "Your account is on the Free plan now"
            : `Keep your ${planName} features after ${props.endsOn}`
      }
    >
      <Text style={text}>Hi {recipientName || "there"},</Text>

      <Text style={text}>{intro(props)}</Text>

      {items.length > 0 && (
        <Section style={panel}>
          {items.map((item) => (
            <Text key={item} style={panelItem}>
              {item}
            </Text>
          ))}
        </Section>
      )}

      <Text style={text}>
        Your links keep redirecting with their current settings, and nothing is deleted.{" "}
        {kind === "ended"
          ? `Upgrading to ${planName} restores everything straight away.`
          : `Upgrade to ${planName} to keep everything as it is. Upgrading later restores it straight away.`}
      </Text>

      <EmailButton href={upgradeUrl}>Upgrade to {planName}</EmailButton>

      <Text style={smallText}>Or copy and paste this URL into your browser:</Text>
      <CodeBlock>{upgradeUrl}</CodeBlock>

      <Text style={text}>Questions? Reply to this email and we&apos;ll help.</Text>

      <Signoff />
    </EmailLayout>
  );
};

PlanGraceEmail.PreviewProps = {
  recipientName: "Ama",
  kind: "started",
  reason: "lapsed",
  planName: "Pro",
  endsOn: "November 27, 2026",
  timeLeft: "7 days",
  items: [
    "Links on custom domains beyond the first one",
    "Password protection on new or edited links",
  ],
  upgradeUrl: "https://ishortn.ink/dashboard/pricing",
} satisfies PlanGraceEmailProps;

export default PlanGraceEmail;
