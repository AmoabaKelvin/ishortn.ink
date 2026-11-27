import { Text } from "@react-email/components";

import { displayName } from "@/lib/utils/user-name";

import { EmailLayout, fieldLabel, panelItem, text, Well } from "./_components/layout";

import type { CSSProperties } from "react";

type FeedbackReplyEmailProps = {
  userName?: string | null;
  reply: string;
  originalMessage: string;
};

export const FeedbackReplyEmail = ({
  userName,
  reply,
  originalMessage,
}: FeedbackReplyEmailProps) => {
  return (
    <EmailLayout preview="We replied to your iShortn feedback">
      <Text style={text}>Hi {displayName(userName) ?? "there"},</Text>

      <Text style={replyText}>{reply}</Text>

      <Text style={text}>If you have more questions, just reply to this email.</Text>
      <Text style={{ ...text, fontWeight: 500 }}>Kelvin &amp; the iShortn team</Text>

      <Well>
        <Text style={{ ...fieldLabel, margin: 0 }}>Your feedback</Text>
        <Text style={quotedText}>{originalMessage}</Text>
      </Well>
    </EmailLayout>
  );
};

// Admins write replies as plain text; keep their line breaks and let long words wrap.
const replyText: CSSProperties = {
  ...text,
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
};

const quotedText: CSSProperties = {
  ...panelItem,
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
};

FeedbackReplyEmail.PreviewProps = {
  userName: "Ama",
  reply:
    "Thanks for flagging this. The invoice is now available under Settings > Billing.\n\nLet us know if anything still looks off.",
  originalMessage: "Where can I download the invoice for my Pro subscription?",
} satisfies FeedbackReplyEmailProps;

export default FeedbackReplyEmail;
