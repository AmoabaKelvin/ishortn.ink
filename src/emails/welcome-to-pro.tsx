import { Link, Text } from "@react-email/components";

import { PLAN_CAPS, type Plan } from "@/lib/billing/plans";
import { SUPPORT_EMAIL } from "@/lib/constants/app";
import { getAppUrl } from "@/lib/constants/domains";
import { displayName } from "@/lib/utils/user-name";

import {
  EmailButton,
  EmailLayout,
  headingText,
  link,
  panelItem,
  text,
  Well,
} from "./_components/layout";

type PaidPlan = Exclude<Plan, "free">;

interface WelcomeEmailProps {
  userName?: string | null;
  plan?: PaidPlan;
}

const planDisplayNames = {
  pro: "Pro",
  ultra: "Ultra",
} satisfies Record<PaidPlan, string>;

const pro = PLAN_CAPS.pro;

// Keep in step with PLAN_FEATURES (src/lib/billing/plan-features.ts), which the pricing page shows.
const planBenefits = {
  pro: [
    `${(pro.linksLimit ?? 0).toLocaleString()} short links per month`,
    `${(pro.eventsLimit ?? 0).toLocaleString()} tracked events per month`,
    "Unlimited analytics history",
    `${pro.domainLimit} custom domains`,
    `${pro.folderLimit} folders`,
    "Geo & device targeting, password protection and REST API access",
  ],
  ultra: [
    "Team workspaces to share links, domains and analytics with your team",
    "Unlimited links & tracked events",
    "Unlimited analytics history",
    "Unlimited custom domains and folders",
    "Unlimited targeting rules, milestones, bio pages and campaigns",
    "Priority support",
  ],
} satisfies Record<PaidPlan, string[]>;

export const WelcomeEmail = ({ userName, plan = "pro" }: WelcomeEmailProps) => {
  const planName = planDisplayNames[plan];

  return (
    <EmailLayout preview={`Welcome to iShortn ${planName}`}>
      <Text style={text}>Hi {displayName(userName) ?? "there"},</Text>

      <Text style={text}>
        Thank you for upgrading to iShortn {planName}! Your account is upgraded and every {planName}{" "}
        feature is ready to use.
      </Text>

      <Text style={headingText}>What&apos;s included in your plan</Text>
      <Well>
        {planBenefits[plan].map((benefit) => (
          <Text key={benefit} style={panelItem}>
            ✓ {benefit}
          </Text>
        ))}
      </Well>

      <EmailButton href={getAppUrl(plan === "ultra" ? "/dashboard/teams/new" : "/dashboard")}>
        {plan === "ultra" ? "Create your team" : "Go to your dashboard"}
      </EmailButton>

      <Text style={text}>
        If you have any questions or need help getting started, reply to this email or reach out at{" "}
        <Link href={`mailto:${SUPPORT_EMAIL}`} style={link}>
          {SUPPORT_EMAIL}
        </Link>
        .
      </Text>

      <Text style={text}>Thanks for choosing iShortn!</Text>
      <Text style={{ ...text, fontWeight: 500 }}>Kelvin &amp; the iShortn team</Text>
    </EmailLayout>
  );
};

WelcomeEmail.PreviewProps = {
  userName: "Ama",
  plan: "ultra",
} satisfies WelcomeEmailProps;

export default WelcomeEmail;
