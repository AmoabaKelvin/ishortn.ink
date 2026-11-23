import { Column, Link, Row, Section, Text } from "@react-email/components";

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

export type WeeklySummaryEmailProps = {
  userName?: string | null;
  /** "November 16 – 22", the summarised Monday-Sunday week. */
  weekLabel: string;
  clicks: number;
  previousClicks: number;
  topLinks: WeeklySummaryTopLink[];
  topCountry: WeeklySummaryTop | null;
  topSource: WeeklySummaryTop | null;
  /** Free accounts whose tracking is paused by the monthly cap. */
  paused: { dropped: number; upgradeUrl: string } | null;
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

export const WeeklySummaryEmail = ({
  userName,
  weekLabel,
  clicks,
  previousClicks,
  topLinks,
  topCountry,
  topSource,
  paused,
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

      {paused && (
        <Text style={text}>
          {`The Free plan's monthly limit has paused tracking, so ${formatClicks(paused.dropped)} this month ${paused.dropped === 1 ? "wasn't" : "weren't"} recorded.`}{" "}
          <Link href={paused.upgradeUrl} style={link}>
            Upgrade to Pro
          </Link>{" "}
          to record them all.
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
  paused: {
    dropped: 342,
    upgradeUrl:
      "https://ishortn.ink/dashboard/pricing?highlight=pro&source=weekly_summary&utm_source=email&utm_medium=lifecycle&utm_campaign=weekly_summary",
  },
  analyticsUrl:
    "https://ishortn.ink/dashboard/analytics/overview?utm_source=email&utm_medium=lifecycle&utm_campaign=weekly_summary",
  unsubscribeUrl: "https://ishortn.ink/api/email/unsubscribe?token=user_1.sig&list=weekly-summary",
  notificationSettingsUrl: "https://ishortn.ink/dashboard/settings#notifications",
} satisfies WeeklySummaryEmailProps;

export default WeeklySummaryEmail;
