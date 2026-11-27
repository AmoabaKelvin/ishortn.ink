import { z } from "zod";

import { normalizeDestinationUrl } from "@/lib/utils/destination-url";

// Contact card codes are dynamic: the QR encodes a short link to a hosted contact page
// (/c/<publicId>) that serves the card and its .vcf, so the card can change after printing.
// Stored as contentType "link" with payloadType "vcard" and the fields in `payloadFields`.

const optionalText = (max: number, label: string) =>
  z.string().trim().max(max, `${label} must be ${max.toLocaleString()} characters or fewer`);

// Phone numbers keep the formatting people type so the card shows them that way; tel: links
// strip it (see telHref).
const optionalPhone = z
  .string()
  .trim()
  .refine((value) => value === "" || /^\+?[\d\s().-]{3,30}$/.test(value), {
    message: "Use digits, spaces and an optional + with the country code",
  })
  .refine((value) => value === "" || /\d{3,}/.test(value.replace(/\D/g, "")), {
    message: "Enter a phone number",
  });

// Only http(s): the contact page renders the website as a link.
const optionalWebsite = z
  .string()
  .trim()
  .max(2048, "Website must be 2,048 characters or fewer")
  .transform((value, ctx) => {
    if (value === "") return "";
    const normalized = normalizeDestinationUrl(value);
    if (!normalized || !/^https?:\/\//i.test(normalized)) {
      ctx.addIssue({ code: "custom", message: "Enter a website, e.g. example.com" });
      return z.NEVER;
    }
    return normalized;
  });

export const vcardPayloadSchema = z
  .object({
    type: z.literal("vcard"),
    firstName: optionalText(100, "First name"),
    lastName: optionalText(100, "Last name"),
    organization: optionalText(150, "Organisation"),
    jobTitle: optionalText(100, "Job title"),
    phone: optionalPhone,
    phone2: optionalPhone,
    email: z
      .string()
      .trim()
      .max(254)
      .refine((value) => value === "" || z.string().email().safeParse(value).success, {
        message: "Enter a valid email address",
      }),
    website: optionalWebsite,
    address: optionalText(300, "Address"),
    note: optionalText(1000, "Note"),
  })
  .superRefine((value, ctx) => {
    if (!value.firstName && !value.organization) {
      ctx.addIssue({
        code: "custom",
        path: ["firstName"],
        message: "Enter a first name or an organisation",
      });
    }
  });

export type VCardPayload = z.infer<typeof vcardPayloadSchema>;

export const VCARD_LABEL = "vCard";

/** The name the card shows: "First Last", or the organisation for a company card. */
export function vcardDisplayName(card: VCardPayload): string {
  return [card.firstName, card.lastName].filter(Boolean).join(" ") || card.organization;
}

/** A one-line description for lists: the name, plus the organisation when both are set. */
export function vcardSummary(card: VCardPayload): string {
  const name = vcardDisplayName(card);
  return card.organization && name !== card.organization ? `${name} · ${card.organization}` : name;
}

export function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

/** RFC 2426 text escaping: backslash, comma and semicolon are backslash-escaped, newlines are \n. */
export function escapeVCardText(value: string) {
  return value.replace(/[\\,;]/g, (char) => `\\${char}`).replace(/\r\n|\r|\n/g, "\\n");
}

const MAX_LINE_OCTETS = 75;

/**
 * Folds a content line at 75 octets (RFC 2426 section 2.6): continuation lines start with a space.
 * Breaks between code points so a multi-byte UTF-8 character is never split.
 */
function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let octets = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    // Continuation lines carry the leading space, so they hold one octet less.
    const limit = parts.length === 0 ? MAX_LINE_OCTETS : MAX_LINE_OCTETS - 1;
    if (octets + size > limit) {
      parts.push(current);
      current = "";
      octets = 0;
    }
    current += char;
    octets += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

/** The card as a vCard 3.0 file: UTF-8, CRLF line endings, empty optional fields left out. */
export function serializeVCard(card: VCardPayload): string {
  const e = escapeVCardText;
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${e(card.lastName)};${e(card.firstName)};;;`,
    `FN:${e(vcardDisplayName(card))}`,
  ];
  // Without a person's name, address books list the card under the company.
  if (!card.firstName && !card.lastName) lines.push("X-ABShowAs:COMPANY");
  if (card.organization) lines.push(`ORG:${e(card.organization)}`);
  if (card.jobTitle) lines.push(`TITLE:${e(card.jobTitle)}`);
  for (const phone of [card.phone, card.phone2]) {
    if (phone) lines.push(`TEL;TYPE=VOICE:${e(phone)}`);
  }
  if (card.email) lines.push(`EMAIL;TYPE=INTERNET:${e(card.email)}`);
  // A URI value, which RFC 2426 doesn't text-escape.
  if (card.website) lines.push(`URL:${card.website}`);
  // The free-text address goes in the street component.
  if (card.address) lines.push(`ADR;TYPE=WORK:;;${e(card.address)};;;;`);
  if (card.note) lines.push(`NOTE:${e(card.note)}`);
  lines.push("END:VCARD");
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}

/** The download's file name: the display name with unsafe characters removed. */
export function vcardFileName(card: VCardPayload) {
  const base = vcardDisplayName(card)
    .normalize("NFC")
    .replace(/[^\p{L}\p{N} ._-]+/gu, "")
    .replace(/^[\s.]+/, "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 80);
  return `${base || "contact"}.vcf`;
}

/** Content-Disposition for the download: an ASCII fallback plus the UTF-8 name (RFC 6266). */
export function vcardAttachmentHeader(card: VCardPayload) {
  const fileName = vcardFileName(card);
  const ascii = /^[\x20-\x7e]+$/.test(fileName) ? fileName : "contact.vcf";
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
