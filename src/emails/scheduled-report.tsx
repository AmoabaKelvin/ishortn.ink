import { Column, Row, Text } from "@react-email/components";

import {
  bigNumber,
  EmailButton,
  EmailLayout,
  panelItem,
  smallText,
  Well,
} from "./_components/layout";
import {
  formatClicks,
  row,
  rowLabel,
  rowName,
  rowUrl,
  rowValue,
  weekChange,
  wellHeading,
  type WeeklySummaryTop,
  type WeeklySummaryTopLink,
} from "./weekly-summary";

export type ScheduledReportFrequency = "weekly" | "monthly";
export type ScheduledReportTargetType = "link" | "folder" | "campaign";

export type ScheduledReportEmailProps = {
  frequency: ScheduledReportFrequency;
  /** "16-22 Nov" or "October 2026". */
  periodLabel: string;
  targetType: ScheduledReportTargetType;
  /** The short URL for a link, else the folder or campaign name. */
  targetName: string;
  /** Who set the report up: their name, team name or email. */
  senderName: string;
  clicks: number;
  previousClicks: number;
  /** Folder and campaign reports only; empty for a link. */
  topLinks: WeeklySummaryTopLink[];
  countries: WeeklySummaryTop[];
  devices: WeeklySummaryTop[];
  sources: WeeklySummaryTop[];
  /** The link's public stats page, when sharing is on. */
  statsUrl: string | null;
  unsubscribeUrl: string | null;
};

const fmt = (count: number) => count.toLocaleString("en-US");

const FREQUENCY_NAMES = { weekly: "Weekly", monthly: "Monthly" } as const;
const PERIOD_BEFORE = { weekly: "the week before", monthly: "the month before" } as const;

/** "Weekly report for ishortn.ink/spring: 1,284 clicks, up 23%". */
export function scheduledReportSubject({
  frequency,
  targetName,
  clicks,
  previousClicks,
}: Pick<ScheduledReportEmailProps, "frequency" | "targetName" | "clicks" | "previousClicks">) {
  const change = weekChange(clicks, previousClicks);
  const subject = `${FREQUENCY_NAMES[frequency]} report for ${targetName}: ${formatClicks(clicks)}`;
  return change ? `${subject}, ${change.direction} ${fmt(change.percent)}%` : subject;
}

/** "Up 23% from 1,043 the week before", or the equivalent for no change or no prior clicks. */
export function comparePeriods(
  clicks: number,
  previousClicks: number,
  frequency: ScheduledReportFrequency,
): string {
  const before = PERIOD_BEFORE[frequency];
  if (previousClicks === 0)
    return clicks === 0 ? `No clicks ${before} either.` : `No clicks ${before}.`;
  if (clicks === previousClicks) return `The same as ${before}.`;
  // Under 1% rounds to 0; say "less than 1%" rather than "Up 0%".
  const change = weekChange(clicks, previousClicks);
  const percent = change ? `${fmt(change.percent)}%` : "less than 1%";
  return `${clicks > previousClicks ? "Up" : "Down"} ${percent} from ${fmt(previousClicks)} ${before}.`;
}

function Breakdown({
  title,
  rows,
  first,
}: {
  title: string;
  rows: WeeklySummaryTop[];
  first: boolean;
}) {
  if (!rows.length) return null;
  return (
    <>
      <Text style={first ? { ...wellHeading, margin: 0 } : wellHeading}>{title}</Text>
      {rows.map((item, index) => (
        <Row key={item.name} style={index === 0 ? undefined : row}>
          <Column style={rowLabel}>
            <Text style={rowName}>{item.name}</Text>
          </Column>
          <Column style={rowValue}>{fmt(item.clicks)}</Column>
        </Row>
      ))}
    </>
  );
}

export const ScheduledReportEmail = (props: ScheduledReportEmailProps) => {
  const {
    frequency,
    periodLabel,
    targetType,
    targetName,
    senderName,
    clicks,
    previousClicks,
    topLinks,
    countries,
    devices,
    sources,
    statsUrl,
    unsubscribeUrl,
  } = props;
  const breakdowns = [
    { title: "Top countries", rows: countries },
    { title: "Devices", rows: devices },
    { title: "Top sources", rows: sources },
  ].filter((item) => item.rows.length > 0);
  const [topCountry] = countries;

  return (
    <EmailLayout
      preview={`${formatClicks(clicks)} in ${periodLabel}.${topCountry ? ` Most came from ${topCountry.name}.` : ""}`}
      eyebrow={`${FREQUENCY_NAMES[frequency]} ${targetType} report · ${periodLabel}`}
      headline={targetName}
      footerReason={`You received this because ${senderName} set up a ${frequency} report for ${targetName}.`}
      unsubscribeUrl={unsubscribeUrl}
    >
      <Well>
        <Text style={bigNumber}>{formatClicks(clicks)}</Text>
        <Text style={{ ...panelItem, color: "#737373" }}>
          {comparePeriods(clicks, previousClicks, frequency)}
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

      {breakdowns.length > 0 && (
        <Well>
          {breakdowns.map((item, index) => (
            <Breakdown key={item.title} title={item.title} rows={item.rows} first={index === 0} />
          ))}
        </Well>
      )}

      {statsUrl && <EmailButton href={statsUrl}>View live stats</EmailButton>}

      <Text style={smallText}>
        {frequency === "weekly"
          ? "Clicks are counted Monday to Sunday, in UTC."
          : "Clicks are counted over the calendar month, in UTC."}
      </Text>
    </EmailLayout>
  );
};

ScheduledReportEmail.PreviewProps = {
  frequency: "monthly",
  periodLabel: "October 2026",
  targetType: "folder",
  targetName: "Acme Studio client links",
  senderName: "Ama Mensah",
  clicks: 4_812,
  previousClicks: 3_907,
  topLinks: [
    { shortUrl: "go.acmestudio.com/menu", name: "Autumn menu", clicks: 2_210 },
    { shortUrl: "go.acmestudio.com/book", name: "Table booking", clicks: 1_384 },
    { shortUrl: "ishortn.ink/acme-ig", name: null, clicks: 702 },
  ],
  countries: [
    { name: "Ghana", clicks: 2_920 },
    { name: "Nigeria", clicks: 811 },
    { name: "United Kingdom", clicks: 402 },
  ],
  devices: [
    { name: "Mobile", clicks: 3_710 },
    { name: "Desktop", clicks: 1_034 },
    { name: "Tablet", clicks: 68 },
  ],
  sources: [
    { name: "Instagram", clicks: 2_104 },
    { name: "Direct", clicks: 1_530 },
    { name: "Google", clicks: 590 },
  ],
  statsUrl: null,
  unsubscribeUrl:
    "https://ishortn.ink/api/email/unsubscribe?token=12%3Aclient%40example.com.sig&list=scheduled-report",
} satisfies ScheduledReportEmailProps;

export default ScheduledReportEmail;
