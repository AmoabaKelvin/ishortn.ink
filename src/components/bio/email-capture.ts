// Email signup blocks. The settings live as JSON in the block's `content`; the
// heading is the block's `title`. Shared by the editor, the service, the public
// form and the subscribe route, so all of them validate the same way.

import { z } from "zod";

export const EMAIL_CAPTURE_DEFAULT_HEADING = "Join my newsletter";
export const EMAIL_CAPTURE_DEFAULT_BUTTON = "Subscribe";
export const EMAIL_CAPTURE_DEFAULT_SUCCESS = "Thanks for subscribing!";
export const EMAIL_CAPTURE_CONSENT_MAX = 300;

export function defaultConsentText(pageName: string): string {
  return `I agree to receive emails from ${pageName}.`;
}

export const emailCaptureSettingsSchema = z.object({
  buttonLabel: z.string().trim().max(60).default(""),
  successMessage: z.string().trim().max(200).default(""),
  // Empty means no consent checkbox.
  consentText: z.string().trim().max(EMAIL_CAPTURE_CONSENT_MAX).default(""),
});

export type EmailCaptureSettings = z.output<typeof emailCaptureSettingsSchema>;

// RFC 5321 caps an address at 254 characters in practice. Stored lowercased so
// "Ana@x.com" and "ana@x.com" are one subscriber.
export const subscriberEmailSchema = z
  .string()
  .trim()
  .max(254, "That email address is too long.")
  .email("Enter a valid email address.")
  .transform((value) => value.toLowerCase());

export function serializeEmailCapture(settings: EmailCaptureSettings): string {
  return JSON.stringify({ kind: "email_capture", ...settings });
}

const storedSchema = emailCaptureSettingsSchema.extend({ kind: z.literal("email_capture") });

/** The stored settings of an email signup block; defaults when missing or invalid. */
export function parseEmailCapture(content: string | null): EmailCaptureSettings {
  try {
    const parsed = storedSchema.safeParse(JSON.parse(content ?? ""));
    if (parsed.success) {
      const { kind: _kind, ...settings } = parsed.data;
      return settings;
    }
  } catch {
    // fall through to defaults
  }
  return { buttonLabel: "", successMessage: "", consentText: "" };
}
