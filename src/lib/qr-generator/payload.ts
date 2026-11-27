import { z } from "zod";

// Static QR payloads: the code encodes the content itself instead of a tracking link, so scans
// aren't recorded and the printed content can't change. Stored as contentType "text" with the
// encoded string in `content`; the form fields go in `payloadFields` so the editor can re-open them.

export const WIFI_SECURITY_TYPES = ["WPA", "WEP", "nopass"] as const;
export type WifiSecurity = (typeof WIFI_SECURITY_TYPES)[number];

export const STATIC_PAYLOAD_TYPES = ["wifi", "email", "sms", "phone"] as const;
export type StaticPayloadType = (typeof STATIC_PAYLOAD_TYPES)[number];

// The largest QR code holds 1,273 bytes at error correction H, which the generator uses with a logo.
export const MAX_STATIC_PAYLOAD_BYTES = 1200;

// Formatting people type into phone numbers; only digits and a leading + are encoded.
const PHONE_SEPARATORS = /[\s().-]/g;

const phoneSchema = z
  .string()
  .trim()
  .min(1, "Enter a phone number")
  .transform((value) => value.replace(PHONE_SEPARATORS, ""))
  .pipe(z.string().regex(/^\+?\d{3,15}$/, "Use digits only, with an optional + and country code"));

export const textPayloadSchema = z.object({
  type: z.literal("text"),
  text: z
    .string()
    .min(1, "Enter the text to encode")
    .max(1000, "Text must be 1,000 characters or fewer"),
});

export const wifiPayloadSchema = z.object({
  type: z.literal("wifi"),
  ssid: z
    .string()
    .min(1, "Enter the network name")
    .max(32, "Network names are at most 32 characters"),
  password: z.string().max(63, "Wi-Fi passwords are at most 63 characters"),
  security: z.enum(WIFI_SECURITY_TYPES),
  hidden: z.boolean(),
});

export const emailPayloadSchema = z.object({
  type: z.literal("email"),
  to: z.string().trim().email("Enter a valid email address").max(254),
  subject: z.string().max(255, "Subject must be 255 characters or fewer"),
  body: z.string().max(1000, "Message must be 1,000 characters or fewer"),
});

export const smsPayloadSchema = z.object({
  type: z.literal("sms"),
  phone: phoneSchema,
  message: z.string().max(500, "Message must be 500 characters or fewer"),
});

export const phonePayloadSchema = z.object({
  type: z.literal("phone"),
  phone: phoneSchema,
});

// discriminatedUnion only takes plain objects, so the cross-field Wi-Fi rule is refined on the union.
export const staticQrPayloadSchema = z
  .discriminatedUnion("type", [
    textPayloadSchema,
    wifiPayloadSchema,
    emailPayloadSchema,
    smsPayloadSchema,
    phonePayloadSchema,
  ])
  .superRefine((value, ctx) => {
    if (value.type === "wifi" && value.security !== "nopass" && value.password.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["password"],
        message: "Enter the network password, or set security to None",
      });
      return;
    }
    if (new TextEncoder().encode(encodeStaticQrPayload(value)).length > MAX_STATIC_PAYLOAD_BYTES) {
      ctx.addIssue({ code: "custom", message: "That's too much content for one QR code" });
    }
  });

export type StaticQrPayload = z.infer<typeof staticQrPayloadSchema>;
export type StaticQrPayloadType = StaticQrPayload["type"];

/** Backslash-escapes the characters the Wi-Fi QR format reserves: \ ; , : " */
export function escapeWifiValue(value: string) {
  return value.replace(/[\\;,:"]/g, (char) => `\\${char}`);
}

export function encodeWifi({
  ssid,
  password,
  security,
  hidden,
}: Omit<z.infer<typeof wifiPayloadSchema>, "type">) {
  const pass = security === "nopass" ? "" : escapeWifiValue(password);
  return `WIFI:T:${security};S:${escapeWifiValue(ssid)};P:${pass};H:${hidden};;`;
}

export function encodeEmail({
  to,
  subject,
  body,
}: Omit<z.infer<typeof emailPayloadSchema>, "type">) {
  const params: string[] = [];
  if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
  // RFC 6068: line breaks in a mailto body are CRLF.
  if (body) params.push(`body=${encodeURIComponent(body.replace(/\r?\n/g, "\r\n"))}`);
  return `mailto:${to.trim()}${params.length ? `?${params.join("&")}` : ""}`;
}

export function encodeSms({ phone, message }: { phone: string; message: string }) {
  return `SMSTO:${phone}:${message}`;
}

export function encodePhone({ phone }: { phone: string }) {
  return `tel:${phone}`;
}

/** The string a static code encodes. Expects a payload already parsed by the schema. */
export function encodeStaticQrPayload(payload: StaticQrPayload): string {
  switch (payload.type) {
    case "text":
      return payload.text;
    case "wifi":
      return encodeWifi(payload);
    case "email":
      return encodeEmail(payload);
    case "sms":
      return encodeSms(payload);
    case "phone":
      return encodePhone(payload);
  }
}

export const STATIC_PAYLOAD_LABELS = {
  text: "Text",
  wifi: "Wi-Fi",
  email: "Email",
  sms: "SMS",
  phone: "Phone",
} satisfies Record<StaticQrPayloadType, string>;

/** A one-line description for lists. Never shows the Wi-Fi password. */
export function staticPayloadSummary(payload: StaticQrPayload): string {
  switch (payload.type) {
    case "text":
      return payload.text;
    case "wifi":
      return payload.ssid;
    case "email":
      return payload.to;
    case "sms":
    case "phone":
      return payload.phone;
  }
}
