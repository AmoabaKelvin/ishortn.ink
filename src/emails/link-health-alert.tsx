import { Link, Text } from "@react-email/components";

import {
  CodeBlock,
  EmailButton,
  EmailLayout,
  fieldLabel,
  link,
  panelItem,
  recordTitle,
  smallText,
  text,
  Well,
} from "./_components/layout";

export type BrokenLinkItem = {
  shortUrl: string;
  name: string | null;
  destination: string;
  /** "404 Not Found", "DNS lookup failed": what the checks saw. */
  problem: string;
  clicksLast7Days: number;
  onQrCode: boolean;
  analyticsUrl: string;
};

export type LinkHealthAlertEmailProps = {
  /** The links listed in full; the rest are counted in `moreCount`. */
  links: BrokenLinkItem[];
  moreCount: number;
  dashboardUrl: string;
  unsubscribeUrl: string | null;
  notificationSettingsUrl: string;
};

const fmt = (count: number) => count.toLocaleString("en-US");

/** "Destination down: go.acme.com/spring" or "3 of your links point to pages that are down". */
export function linkHealthAlertSubject(links: BrokenLinkItem[], moreCount: number): string {
  const total = links.length + moreCount;
  if (total === 1 && links[0]) return `Destination down: ${links[0].shortUrl}`;
  return `${fmt(total)} of your links point to pages that are down`;
}

export const LinkHealthAlertEmail = ({
  links,
  moreCount,
  dashboardUrl,
  unsubscribeUrl,
  notificationSettingsUrl,
}: LinkHealthAlertEmailProps) => {
  const total = links.length + moreCount;
  const single = total === 1;

  return (
    <EmailLayout
      preview={
        single
          ? `${links[0]?.shortUrl} sends visitors to a page that isn't working.`
          : `${fmt(total)} links send visitors to pages that aren't working.`
      }
      eyebrow="Broken destination alert"
      headline={
        single
          ? "A link's destination stopped working"
          : `${fmt(total)} destinations stopped working`
      }
      notificationSettingsUrl={notificationSettingsUrl}
      unsubscribeUrl={unsubscribeUrl}
    >
      <Text style={text}>
        We check your active links and QR codes once a day.{" "}
        {single ? "This link's destination" : "These links' destinations"} failed two checks in a
        row, so visitors are landing on an error instead of your page.
      </Text>

      {/* One stacked block per link: tables overflow on narrow screens. */}
      {links.map((item) => (
        <Well key={item.shortUrl}>
          <Text style={recordTitle}>
            <Link href={item.analyticsUrl} style={link}>
              {item.shortUrl}
            </Link>
          </Text>
          {item.name && <Text style={{ ...panelItem, margin: "0 0 4px" }}>{item.name}</Text>}
          <Text style={fieldLabel}>Destination</Text>
          <CodeBlock>{item.destination}</CodeBlock>
          <Text style={panelItem}>
            <strong>{item.problem}</strong> &middot; {fmt(item.clicksLast7Days)}{" "}
            {item.clicksLast7Days === 1 ? "click" : "clicks"} in the last 7 days
            {item.onQrCode ? " · On a QR code" : ""}
          </Text>
        </Well>
      ))}

      {moreCount > 0 && (
        <Text style={smallText}>
          And {fmt(moreCount)} more {moreCount === 1 ? "link" : "links"}, marked &ldquo;Destination
          down&rdquo; in your dashboard.
        </Text>
      )}

      <Text style={text}>
        Update the destination to send visitors somewhere that works. QR codes keep working after
        the change, so nothing needs reprinting.
      </Text>

      <EmailButton href={dashboardUrl}>Review links</EmailButton>

      <Text style={smallText}>
        We won&apos;t email about {single ? "this link" : "these links"} again unless{" "}
        {single ? "it recovers and then breaks" : "they recover and then break"} again.
      </Text>
    </EmailLayout>
  );
};

LinkHealthAlertEmail.PreviewProps = {
  links: [
    {
      shortUrl: "ishortn.ink/spring-menu",
      name: "Spring menu (table QR)",
      destination: "https://www.acmebistro.com/menus/spring-2026-final.pdf",
      problem: "404 Not Found",
      clicksLast7Days: 312,
      onQrCode: true,
      analyticsUrl: "https://ishortn.ink/dashboard/analytics/spring-menu?domain=ishortn.ink",
    },
    {
      shortUrl: "go.acmebistro.com/manual",
      name: null,
      destination: "https://support.acme-old-domain.com/manuals/blender-x200",
      problem: "DNS lookup failed",
      clicksLast7Days: 1,
      onQrCode: false,
      analyticsUrl: "https://ishortn.ink/dashboard/analytics/manual?domain=go.acmebistro.com",
    },
  ],
  moreCount: 0,
  dashboardUrl: "https://ishortn.ink/dashboard",
  unsubscribeUrl: "https://ishortn.ink/api/email/unsubscribe?token=preview",
  notificationSettingsUrl: "https://ishortn.ink/dashboard/settings#notifications",
} satisfies LinkHealthAlertEmailProps;

export default LinkHealthAlertEmail;
