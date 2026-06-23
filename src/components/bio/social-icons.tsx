import {
  IconBrandFacebook,
  IconBrandGithub,
  IconBrandInstagram,
  IconBrandLinkedin,
  IconBrandSnapchat,
  IconBrandTelegram,
  IconBrandThreads,
  IconBrandTiktok,
  IconBrandTwitch,
  IconBrandWhatsapp,
  IconBrandX,
  IconBrandYoutube,
  IconMail,
  IconWorld,
} from "@tabler/icons-react";

import type { ComponentType } from "react";

type IconComponent = ComponentType<{ size?: number; stroke?: number; className?: string }>;

export const SOCIAL_PLATFORMS: { value: string; label: string; icon: IconComponent }[] = [
  { value: "website", label: "Website", icon: IconWorld },
  { value: "twitter", label: "X", icon: IconBrandX },
  { value: "instagram", label: "Instagram", icon: IconBrandInstagram },
  { value: "tiktok", label: "TikTok", icon: IconBrandTiktok },
  { value: "youtube", label: "YouTube", icon: IconBrandYoutube },
  { value: "facebook", label: "Facebook", icon: IconBrandFacebook },
  { value: "linkedin", label: "LinkedIn", icon: IconBrandLinkedin },
  { value: "github", label: "GitHub", icon: IconBrandGithub },
  { value: "whatsapp", label: "WhatsApp", icon: IconBrandWhatsapp },
  { value: "telegram", label: "Telegram", icon: IconBrandTelegram },
  { value: "threads", label: "Threads", icon: IconBrandThreads },
  { value: "twitch", label: "Twitch", icon: IconBrandTwitch },
  { value: "snapchat", label: "Snapchat", icon: IconBrandSnapchat },
  { value: "email", label: "Email", icon: IconMail },
];

const ICON_MAP = new Map(SOCIAL_PLATFORMS.map((p) => [p.value, p.icon]));

export function socialIcon(platform: string): IconComponent {
  return ICON_MAP.get(platform) ?? IconWorld;
}
