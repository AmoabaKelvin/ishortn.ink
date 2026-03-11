import { env } from "@/env.mjs";

export type DiscordEmbedField = {
  name: string;
  value: string;
  inline?: boolean;
};

export type DiscordEmbed = {
  title?: string;
  description?: string;
  color?: number;
  fields?: DiscordEmbedField[];
  timestamp?: string;
  footer?: {
    text: string;
  };
};

export type DiscordNotificationPayload = {
  content?: string;
  embeds?: DiscordEmbed[];
};

export const DISCORD_COLORS = {
  success: 0x22c55e,
  warning: 0xf59e0b,
  error: 0xef4444,
  info: 0x3b82f6,
  downgrade: 0xf97316,
} as const;

export async function sendDiscordNotification(
  payload: DiscordNotificationPayload
): Promise<boolean> {
  const webhookUrl = env.DISCORD_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn("Discord webhook URL not configured, skipping notification");
    return false;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error("Failed to send Discord notification:", response.statusText);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error sending Discord notification:", error);
    return false;
  }
}

const FEEDBACK_TYPE_LABELS: Record<string, string> = {
  bug: "Bug Report",
  feature: "Feature Request",
  question: "General Question",
};

const FEEDBACK_TYPE_COLORS: Record<string, number> = {
  bug: DISCORD_COLORS.error,
  feature: DISCORD_COLORS.info,
  question: DISCORD_COLORS.warning,
};

export async function sendFeedbackNotification(params: {
  userEmail: string;
  userName?: string | null;
  feedbackType: string;
  message: string;
  imageUrls?: string[];
}): Promise<boolean> {
  const { userEmail, userName, feedbackType, message, imageUrls } = params;

  const embed: DiscordEmbed = {
    title: FEEDBACK_TYPE_LABELS[feedbackType] ?? "Feedback",
    color: FEEDBACK_TYPE_COLORS[feedbackType] ?? DISCORD_COLORS.info,
    fields: [
      {
        name: "From",
        value: userName ? `${userName} (${userEmail})` : userEmail,
        inline: true,
      },
      {
        name: "Type",
        value: FEEDBACK_TYPE_LABELS[feedbackType] ?? feedbackType,
        inline: true,
      },
      {
        name: "Message",
        value: message.length > 1024 ? message.slice(0, 1021) + "..." : message,
        inline: false,
      },
    ],
    timestamp: new Date().toISOString(),
    footer: {
      text: "iShortn Feedback",
    },
  };

  if (imageUrls && imageUrls.length > 0) {
    embed.fields!.push({
      name: "Attachments",
      value: imageUrls.map((url, i) => `[Image ${i + 1}](${url})`).join(" | "),
      inline: false,
    });
  }

  return sendDiscordNotification({ embeds: [embed] });
}

export async function sendDowngradeFeedbackNotification(params: {
  userEmail: string;
  userName?: string | null;
  fromPlan: string;
  toPlan: string;
  reason: string;
  additionalFeedback?: string;
}): Promise<boolean> {
  const { userEmail, userName, fromPlan, toPlan, reason, additionalFeedback } =
    params;

  const embed: DiscordEmbed = {
    title: "Subscription Downgrade",
    color: DISCORD_COLORS.downgrade,
    fields: [
      {
        name: "User",
        value: userName ? `${userName} (${userEmail})` : userEmail,
        inline: true,
      },
      {
        name: "Plan Change",
        value: `${fromPlan} → ${toPlan}`,
        inline: true,
      },
      {
        name: "Reason",
        value: reason,
        inline: false,
      },
    ],
    timestamp: new Date().toISOString(),
    footer: {
      text: "iShortn Feedback",
    },
  };

  if (additionalFeedback) {
    embed.fields!.push({
      name: "Additional Feedback",
      value: additionalFeedback,
      inline: false,
    });
  }

  return sendDiscordNotification({ embeds: [embed] });
}
