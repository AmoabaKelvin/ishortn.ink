import { Text } from "@react-email/components";

import { EmailButton, EmailLayout, Signoff, text } from "./_components/layout";

import type { Plan } from "@/lib/billing/plans";

type EventUsageAlertEmailProps = {
  userName?: string | null;
  threshold: number;
  limit: number;
  currentCount: number;
  plan: Plan;
  resetDate: string;
  upgradeUrl: string;
  notificationSettingsUrl: string;
};

const PLAN_NAMES = { free: "Free", pro: "Pro", ultra: "Ultra" } satisfies Record<Plan, string>;

export const EventUsageAlertEmail = ({
  userName,
  threshold,
  limit,
  currentCount,
  plan,
  resetDate,
  upgradeUrl,
  notificationSettingsUrl,
}: EventUsageAlertEmailProps) => {
  const capReached = threshold >= 100;
  const planName = PLAN_NAMES[plan];

  return (
    <EmailLayout
      preview={
        capReached
          ? "Analytics recording is paused until your monthly cap resets"
          : `You've used ${threshold}% of your monthly analytics events`
      }
      notificationSettingsUrl={notificationSettingsUrl}
    >
      <Text style={text}>Hi {userName || "there"},</Text>

      {capReached ? (
        <>
          <Text style={text}>
            You&apos;ve used all {limit.toLocaleString()} analytics events included in the{" "}
            {planName} plan this month, so new clicks aren&apos;t being recorded until your cap
            resets on {resetDate}.
          </Text>
          <Text style={text}>
            Your links keep redirecting as normal; only analytics are paused. Upgrade to resume
            recording straight away.
          </Text>
        </>
      ) : (
        <>
          <Text style={text}>
            Heads up: you&apos;ve used {currentCount.toLocaleString()} of the{" "}
            {limit.toLocaleString()} analytics events included in the {planName} plan this month (
            {threshold}%).
          </Text>
          <Text style={text}>
            Your links will keep redirecting either way, but analytics recording pauses once you
            reach the cap, until it resets on {resetDate}. Upgrade to raise or remove the cap.
          </Text>
        </>
      )}

      <EmailButton href={upgradeUrl}>Compare plans</EmailButton>

      <Text style={text}>
        If this doesn&apos;t look right, reply to this email and we&apos;ll help out.
      </Text>

      <Signoff />
    </EmailLayout>
  );
};

EventUsageAlertEmail.PreviewProps = {
  userName: "Ama",
  threshold: 100,
  limit: 1000,
  currentCount: 1000,
  plan: "free",
  resetDate: "December 1",
  upgradeUrl: "https://ishortn.ink/dashboard/pricing",
  notificationSettingsUrl: "https://ishortn.ink/dashboard/settings#notifications",
} satisfies EventUsageAlertEmailProps;

export default EventUsageAlertEmail;
