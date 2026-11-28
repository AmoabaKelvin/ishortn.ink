import { Column, Link, Row, Text } from "@react-email/components";

import { PLAN_CAPS } from "@/lib/billing/plans";
import { EMAIL_LINKS, emailLinkUrl } from "@/lib/email/links";

import {
  bigNumber,
  EmailButton,
  EmailLayout,
  link,
  monoFontFamily,
  panelItem,
  smallText,
  text,
  Well,
} from "./_components/layout";

import type { CSSProperties } from "react";

export type WeeklySummaryTopLink = { shortUrl: string; name: string | null; clicks: number };
export type WeeklySummaryTop = { name: string; clicks: number };

/**
 * The one upgrade prompt a Free account can get: tracking paused by the monthly cap (`count` is
 * the clicks not tracked; the main button becomes the upgrade), 60%+ of the cap used (`count` is
 * the clicks tracked), or clicks older than the Free analytics window (`count` is how many are
 * hidden).
 */
export type WeeklySummaryUpgrade = { reason: "paused" | "cap" | "history"; count: number };

export type WeeklySummaryEmailProps = {
  /** "16-22 Nov", the summarised Monday-Sunday week. */
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

const fmt = (count: number) => count.toLocaleString("en-US");

export const formatClicks = (count: number) => `${fmt(count)} ${count === 1 ? "click" : "clicks"}`;

/** The week-on-week change as a whole percentage, or null with no prior week or no change. */
export function weekChange(clicks: number, previousClicks: number) {
  if (previousClicks === 0) return null;
  const percent = Math.round((Math.abs(clicks - previousClicks) / previousClicks) * 100);
  if (percent === 0) return null;
  return { direction: clicks > previousClicks ? "up" : "down", percent } as const;
}

/** "Your links got 1,284 clicks last week, up 23%"; the change is left out when there is none. */
export function weeklySummarySubject(clicks: number, previousClicks: number): string {
  const change = weekChange(clicks, previousClicks);
  const subject = `Your links got ${formatClicks(clicks)} last week`;
  return change ? `${subject}, ${change.direction} ${fmt(change.percent)}%` : subject;
}

/** "Top link: Spring launch with 742 clicks. Most clicks came from Ghana." */
export function weeklySummaryPreview({
  clicks,
  previousClicks,
  topLinks: [topLink],
  topCountry,
}: Pick<WeeklySummaryEmailProps, "clicks" | "previousClicks" | "topLinks" | "topCountry">) {
  const parts = [
    topLink
      ? `Top link: ${topLink.name ?? topLink.shortUrl} with ${formatClicks(topLink.clicks)}.`
      : weeklySummarySubject(clicks, previousClicks) + ".",
  ];
  if (topCountry) parts.push(`Most clicks came from ${topCountry.name}.`);
  return parts.join(" ");
}

/** "Up 23% from 1,043 the week before", or the equivalent for no change or no clicks. */
export function compareWeeks(clicks: number, previousClicks: number): string {
  if (previousClicks === 0) return "Your links had no clicks the week before.";
  if (clicks === previousClicks) return "The same as the week before.";
  // Under 1% rounds to 0; say "less than 1%" rather than "Up 0%".
  const change = weekChange(clicks, previousClicks);
  const percent = change ? `${fmt(change.percent)}%` : "less than 1%";
  const direction = clicks > previousClicks ? "Up" : "Down";
  return `${direction} ${percent} from ${fmt(previousClicks)} the week before.`;
}

/** The inline upgrade sentence for "cap" and "history", split around the "Upgrade to Pro" link. */
export function upgradeCopy({ reason, count }: WeeklySummaryUpgrade) {
  if (reason === "cap") {
    return {
      lead: `You've used ${fmt(count)} of ${fmt(PLAN_CAPS.free.eventsLimit ?? 0)} tracked clicks this month.`,
      tail: `for ${fmt(PLAN_CAPS.pro.eventsLimit ?? 0)} a month.`,
    };
  }
  const days = PLAN_CAPS.free.analyticsRangeLimitDays ?? 0;
  return {
    lead: `${formatClicks(count)} older than ${days} days ${count === 1 ? "is" : "are"} hidden on the Free plan.`,
    tail: "to see your full history.",
  };
}

/** The paused-tracking well: what was missed, then what each plan tracks. */
export function pausedCopy(count: number) {
  return {
    lead: `${formatClicks(count)} this month ${count === 1 ? "wasn't" : "weren't"} tracked.`,
    detail: `Free includes ${fmt(PLAN_CAPS.free.eventsLimit ?? 0)} tracked clicks a month and your links passed that. Pro includes ${fmt(PLAN_CAPS.pro.eventsLimit ?? 0)}.`,
  };
}

export const WeeklySummaryEmail = (props: WeeklySummaryEmailProps) => {
  const {
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
  } = props;
  const paused = upgrade?.reason === "paused" ? upgrade : null;
  const inlineUpgrade = upgrade && upgrade.reason !== "paused" ? upgrade : null;
  const pausedText = paused && pausedCopy(paused.count);
  const upgradeText = inlineUpgrade && upgradeCopy(inlineUpgrade);

  return (
    <EmailLayout
      preview={weeklySummaryPreview(props)}
      eyebrow={`Weekly summary · ${weekLabel}`}
      notificationSettingsUrl={notificationSettingsUrl}
      footerReason="You received this weekly summary because your links got clicks last week."
      unsubscribeUrl={unsubscribeUrl}
    >
      <Well>
        <Text style={bigNumber}>{formatClicks(clicks)}</Text>
        <Text style={{ ...panelItem, color: "#737373" }}>
          {compareWeeks(clicks, previousClicks)}
        </Text>

        {topLinks.length > 0 && (
          <>
            <Text style={wellHeading}>Top links</Text>
            {topLinks.map((item, index) => (
              <Row key={item.shortUrl} style={index === 0 ? undefined : row}>
                <Column style={rowLabel}>
                  {item.name && <Text style={rowName}>{item.name}</Text>}
                  <Text style={rowUrl}>{item.shortUrl}</Text>
                </Column>
                <Column style={rowValue}>{fmt(item.clicks)}</Column>
              </Row>
            ))}
          </>
        )}
      </Well>

      {(topCountry || topSource) && (
        <Text style={text}>
          Most clicks came from{" "}
          {topCountry && (
            <>
              <strong>{topCountry.name}</strong> ({fmt(topCountry.clicks)})
            </>
          )}
          {topCountry && topSource && " and "}
          {topSource && (
            <>
              <strong>{topSource.name}</strong> ({fmt(topSource.clicks)})
            </>
          )}
          .
        </Text>
      )}

      {pausedText && (
        <Well>
          <Text style={{ ...panelItem, color: "#171717", fontWeight: 600 }}>{pausedText.lead}</Text>
          <Text style={panelItem}>{pausedText.detail}</Text>
        </Well>
      )}

      {inlineUpgrade && upgradeText && (
        <Text style={text}>
          {upgradeText.lead}{" "}
          <Link href={inlineUpgrade.upgradeUrl} style={link}>
            Upgrade to Pro
          </Link>{" "}
          {upgradeText.tail}
        </Text>
      )}

      {paused ? (
        <>
          <EmailButton href={paused.upgradeUrl}>Track every click</EmailButton>
          <Text style={smallText}>
            Or{" "}
            <Link href={analyticsUrl} style={link}>
              open your analytics
            </Link>
            .
          </Text>
        </>
      ) : (
        <EmailButton href={analyticsUrl}>View analytics</EmailButton>
      )}
    </EmailLayout>
  );
};

export const row: CSSProperties = {
  borderTop: "1px solid #e8e8e8",
};

export const rowLabel: CSSProperties = {
  padding: "8px 12px 8px 0",
  verticalAlign: "top",
};

export const rowName: CSSProperties = {
  color: "#171717",
  fontSize: "14px",
  lineHeight: "20px",
  margin: 0,
  overflowWrap: "anywhere",
};

export const rowUrl: CSSProperties = {
  color: "#737373",
  fontFamily: monoFontFamily,
  fontSize: "12px",
  lineHeight: "18px",
  margin: 0,
  wordBreak: "break-all",
};

export const wellHeading: CSSProperties = {
  ...panelItem,
  color: "#171717",
  fontWeight: 600,
  margin: "16px 0 0",
};

export const rowValue: CSSProperties = {
  color: "#171717",
  fontSize: "14px",
  fontWeight: 600,
  padding: "8px 0",
  textAlign: "right",
  verticalAlign: "top",
  whiteSpace: "nowrap",
  width: "1%",
};

WeeklySummaryEmail.PreviewProps = {
  weekLabel: "16-22 Nov",
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
    reason: "paused",
    count: 342,
    upgradeUrl: emailLinkUrl(EMAIL_LINKS.weeklySummary.upgrade.paused),
  },
  analyticsUrl: emailLinkUrl(EMAIL_LINKS.weeklySummary.analytics),
  unsubscribeUrl: "https://ishortn.ink/api/email/unsubscribe?token=user_1.sig&list=weekly-summary",
  notificationSettingsUrl: "https://ishortn.ink/dashboard/settings#notifications",
} satisfies WeeklySummaryEmailProps;

export default WeeklySummaryEmail;
