// WhatsApp order blocks. They're stored as link blocks (so they share the
// tracked hidden link, click analytics and the Free plan's link-block cap) with
// the WhatsApp details kept as JSON in the block's `content`; that JSON is what
// marks a link block as a WhatsApp block.

import { z } from "zod";

export const WHATSAPP_DEFAULT_LABEL = "Order on WhatsApp";
export const WHATSAPP_MESSAGE_MAX = 500;

// E.164: a "+", a country code that doesn't start with 0, and at most 15 digits
// in total. Spaces, dashes, dots and brackets people type are dropped first.
export const whatsappPhoneSchema = z
  .string()
  .transform((value) => value.replace(/[\s().-]/g, ""))
  .pipe(
    z
      .string()
      .regex(
        /^\+[1-9]\d{6,14}$/,
        "Enter the number in international format with the country code, e.g. +233241234567.",
      ),
  );

export const whatsappDetailsSchema = z.object({
  phone: whatsappPhoneSchema,
  message: z.string().trim().max(WHATSAPP_MESSAGE_MAX).default(""),
});

export type WhatsAppDetails = z.output<typeof whatsappDetailsSchema>;

export function buildWhatsAppUrl({ phone, message }: WhatsAppDetails): string {
  const base = `https://wa.me/${phone.replace(/\D/g, "")}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export function serializeWhatsApp(details: WhatsAppDetails): string {
  return JSON.stringify({ kind: "whatsapp", phone: details.phone, message: details.message });
}

const storedSchema = z.object({
  kind: z.literal("whatsapp"),
  phone: z.string(),
  message: z.string(),
});

/** The WhatsApp details of a link block, or null for an ordinary link block. */
export function parseWhatsApp(content: string | null): WhatsAppDetails | null {
  if (!content) return null;
  try {
    const parsed = storedSchema.safeParse(JSON.parse(content));
    return parsed.success ? { phone: parsed.data.phone, message: parsed.data.message } : null;
  } catch {
    return null;
  }
}
