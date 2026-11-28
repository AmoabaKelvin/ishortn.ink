import type { WebhookEventType } from "@/lib/webhooks";

export const WEBHOOK_EVENT_OPTIONS: { type: WebhookEventType; label: string; hint: string }[] = [
  { type: "link.created", label: "Link created", hint: "In the dashboard, API or extension" },
  { type: "link.updated", label: "Link updated", hint: "Saved in the editor or the API" },
  { type: "link.deleted", label: "Link deleted", hint: "One at a time or in bulk" },
  { type: "domain.verified", label: "Domain verified", hint: "A custom domain goes live" },
];

export const pluralize = (count: number, word: string) =>
  `${count.toLocaleString()} ${word}${count === 1 ? "" : "s"}`;
