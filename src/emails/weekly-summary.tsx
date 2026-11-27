import { Column, Link, Row, Section, Text } from "@react-email/components";

import { PLAN_CAPS } from "@/lib/billing/plans";
import { displayName } from "@/lib/utils/user-name";

import {
  EmailButton,
  EmailLayout,
  headingText,
  link,
  panel,
  panelItem,
  text,
} from "./_components/layout";

import type { CSSProperties } from "react";

export type WeeklySummaryTopLink = { shortUrl: string; name: string | null; clicks: number };
export type WeeklySummaryTop = { name: string; clicks: number };

/**
 * The one upgrade line a Free account can get: tracking paused by the monthly cap (`count` is
 * the visits dropped), 60%+ of the cap used (`count` is the visits tracked), or clicks older
 * than the Free analytics window (`count` is how many are hidden).
 */
export type WeeklySummaryUpgrade = { reason: "paused" | "cap" | "history"; count: number };

export type WeeklySummaryEmailProps = {
  userName?: string | null;
  /** "November 16 – 22", the summarised Monday-Sunday week. */
  weekLabel: string;
  clicks: number;
  previousClicks: number;
  topLinks: WeeklySummaryTopLink[];
  topCountry: WeeklySummaryTop | null;
  topSource: WeeklySummaryTop | null;
  upgrade: (WeeklySummaryUpgrade & { upgradeUrl: string }) | null;
  analyticsUrl: string;
  unsubscribeUrl: string | null;
  notificationSettingsUrl: string;
};

export const formatClicks = (count: number) =>
  `${count.toLocaleString("en-US")} ${count === 1 ? "click" : "clicks"}`;

/** "Up 23% from 1,003 clicks the week before", or the equivalent for no change or no clicks. */
export function compareWeeks(clicks: number, previousClicks: number): string {
  if (previousClicks === 0) return "Your links had no clicks the week before.";
  if (clicks === previousClicks) return "The same as the week before.";
  const change = Math.round((Math.abs(clicks - previousClicks) / previousClicks) * 100);
  // Under 1% rounds to 0; say "less than 1%" rather than "Up 0%".
  const percent = change === 0 ? "less than 1%" : `${change.toLocaleString("en-US")}%`;
  const direction = clicks > previousClicks ? "Up" : "Down";
  return `${direction} ${percent} from ${formatClicks(previousClicks)} the week before.`;
}

const fmt = (count: number) => count.toLocaleString("en-US");

/** The upgrade sentence, split around the inline "Upgrade to Pro" link. */
export function upgradeCopy({ reason, count }: WeeklySummaryUpgrade) {
  if (reason === "paused") {
    return {
      lead: `The Free plan's monthly limit has paused tracking, so ${formatClicks(count)} this month ${count === 1 ? "wasn't" : "weren't"} recorded.`,
      tail: "to record them all.",
    };
  }
  if (reason === "cap") {
    return {
      lead: `You've used ${fmt(count)} of ${fmt(PLAN_CAPS.free.eventsLimit ?? 0)} tracked visits this month.`,
      tail: `for ${fmt(PLAN_CAPS.pro.eventsLimit ?? 0)} a month.`,
    };
  }
  const days = PLAN_CAPS.free.analyticsRangeLimitDays ?? 0;
  return {
    lead: `${formatClicks(count)} older than ${days} days ${count === 1 ? "is" : "are"} hidden on the Free plan.`,
    tail: "to see your full history.",
  };
}

export const WeeklySummaryEmail = ({
  userName,
  weekLabel,
  clicks,
  previousClicks,
  topLinks,
  topCountry,
  topSource,
  upgrade,
  analyticsUrl,
  unsubscribeUrl,
  notificationSettingsUrl,
}: WeeklySummaryEmailProps) => {
  return (
    <EmailLayout
      preview={`${formatClicks(clicks)} on your links, ${weekLabel}`}
      notificationSettingsUrl={notificationSettingsUrl}
      footerReason="You received this weekly summary because your links got clicks last week."
      unsubscribeUrl={unsubscribeUrl}
    >
      <Text style={text}>Hi {displayName(userName) ?? "there"},</Text>

      <Text style={text}>Here&apos;s how your links did last week ({weekLabel}, UTC).</Text>

      <Section style={panel}>
        <Text style={bigNumber}>{formatClicks(clicks)}</Text>
        <Text style={{ ...panelItem, color: "#6b7280" }}>
          {compareWeeks(clicks, previousClicks)}
        </Text>
      </Section>

      {topLinks.length > 0 && (
        <>
          <Text style={headingText}>Top links</Text>
          {topLinks.map((item) => (
            <Row key={item.shortUrl} style={row}>
              <Column style={rowLabel}>
                {item.name && <Text style={rowName}>{item.name}</Text>}
                <Text style={item.name ? rowUrlMuted : rowName}>{item.shortUrl}</Text>
              </Column>
              <Column style={rowValue}>{item.clicks.toLocaleString("en-US")}</Column>
            </Row>
          ))}
        </>
      )}

      {(topCountry || topSource) && (
        <Section style={{ margin: "16px 0 0" }}>
          {topCountry && (
            <Text style={panelItem}>
              Top country: <strong>{topCountry.name}</strong> ({formatClicks(topCountry.clicks)})
            </Text>
          )}
          {topSource && (
            <Text style={panelItem}>
              Top source: <strong>{topSource.name}</strong> ({formatClicks(topSource.clicks)})
            </Text>
          )}
        </Section>
      )}

      {upgrade && (
        <Text style={text}>
          {upgradeCopy(upgrade).lead}{" "}
          <Link href={upgrade.upgradeUrl} style={link}>
            Upgrade to Pro
          </Link>{" "}
          {upgradeCopy(upgrade).tail}
        </Text>
      )}

      <EmailButton href={analyticsUrl}>View your analytics</EmailButton>
    </EmailLayout>
  );
};

const bigNumber: CSSProperties = {
  color: "#111827",
  fontSize: "28px",
  fontWeight: 600,
  lineHeight: "36px",
  margin: "0 0 4px",
};

const row: CSSProperties = {
  borderBottom: "1px solid #e5e7eb",
};

const rowLabel: CSSProperties = {
  padding: "8px 12px 8px 0",
  verticalAlign: "top",
};

const rowName: CSSProperties = {
  color: "#111827",
  fontSize: "14px",
  lineHeight: "20px",
  margin: 0,
  overflowWrap: "anywhere",
};

const rowUrlMuted: CSSProperties = {
  color: "#6b7280",
  fontSize: "13px",
  lineHeight: "18px",
  margin: 0,
  wordBreak: "break-all",
};

const rowValue: CSSProperties = {
  color: "#111827",
  fontSize: "14px",
  fontWeight: 600,
  padding: "8px 0",
  textAlign: "right",
  verticalAlign: "top",
  whiteSpace: "nowrap",
  width: "1%",
};

WeeklySummaryEmail.PreviewProps = {
  userName: "Ama",
  weekLabel: "November 16 – 22",
  clicks: 1_284,
  previousClicks: 1_043,
  topLinks: [
    { shortUrl: "ishortn.ink/spring-launch", name: "Spring launch newsletter", clicks: 742 },
    { shortUrl: "go.acmestudio.com/menu", name: null, clicks: 318 },
    { shortUrl: "ishortn.ink/ig-bio", name: "Instagram bio", clicks: 97 },
  ],
  topCountry: { name: "Ghana", clicks: 611 },
  topSource: { name: "Instagram", clicks: 402 },
  upgrade: {
    reason: "cap",
    count: 640,
    upgradeUrl:
      "https://ishortn.ink/dashboard/pricing?highlight=pro&source=weekly_summary_cap&utm_source=email&utm_medium=lifecycle&utm_campaign=weekly_summary",
  },
  analyticsUrl:
    "https://ishortn.ink/dashboard/analytics/overview?utm_source=email&utm_medium=lifecycle&utm_campaign=weekly_summary",
  unsubscribeUrl: "https://ishortn.ink/api/email/unsubscribe?token=user_1.sig&list=weekly-summary",
  notificationSettingsUrl: "https://ishortn.ink/dashboard/settings#notifications",
} satisfies WeeklySummaryEmailProps;

export default WeeklySummaryEmail;
