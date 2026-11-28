import { Link, Text } from "@react-email/components";

import { EMAIL_LINKS, emailLinkUrl } from "@/lib/email/links";
import { displayName } from "@/lib/utils/user-name";

import { EmailButton, EmailLayout, link, smallText, text } from "./_components/layout";

type ApiAccessSunsetEmailProps = {
  userName?: string | null;
  /** Formatted cutoff, e.g. "November 28, 2026 at 12:00 PM UTC". */
  sunsetDate: string;
  upgradeUrl: string;
  kind: "notice" | "reminder";
};

export const ApiAccessSunsetEmail = ({
  userName,
  sunsetDate,
  upgradeUrl,
  kind,
}: ApiAccessSunsetEmailProps) => {
  const preview =
    kind === "reminder"
      ? `Your iShortn API key stops working on ${sunsetDate}`
      : "API access is moving to the Pro plan";

  return (
    <EmailLayout preview={preview}>
      <Text style={text}>Hi {displayName(userName) ?? "there"},</Text>

      {kind === "reminder" ? (
        <Text style={text}>
          A reminder that the API key on your iShortn account stops working on{" "}
          <strong>{sunsetDate}</strong>, about 24 hours from now. After that, API requests with it
          will return an error until the account is on Pro or Ultra.
        </Text>
      ) : (
        <Text style={text}>
          The iShortn REST API is now part of the Pro and Ultra plans. Your account has an API key
          but isn&apos;t on a paid plan, so the key keeps working on Free limits until{" "}
          <strong>{sunsetDate}</strong> and then stops.
        </Text>
      )}

      <Text style={text}>
        Upgrading keeps your existing key working with no changes to your integration, and raises
        your API rate limits.
      </Text>

      <EmailButton href={upgradeUrl}>See plans</EmailButton>

      <Text style={smallText}>
        Or copy this link:{" "}
        <Link href={upgradeUrl} style={link}>
          {upgradeUrl}
        </Link>
      </Text>

      <Text style={text}>
        Links you already created keep redirecting either way. Questions? Reply to this email.
      </Text>

      <Text style={{ ...text, fontWeight: 500 }}>Kelvin &amp; the iShortn team</Text>
    </EmailLayout>
  );
};

ApiAccessSunsetEmail.PreviewProps = {
  userName: "Ama",
  sunsetDate: "November 28, 2026 at 12:00 PM UTC",
  upgradeUrl: emailLinkUrl(EMAIL_LINKS.apiAccessSunset.pricing),
  kind: "notice",
} satisfies ApiAccessSunsetEmailProps;

export default ApiAccessSunsetEmail;
