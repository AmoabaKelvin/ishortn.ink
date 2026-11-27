import { and, eq } from "drizzle-orm";
import { cache } from "react";

import { db } from "@/server/db";
import { qrcode } from "@/server/db/schema";

import type { VCardPayload } from "@/lib/qr-generator/vcard";

const PUBLIC_ID = /^[\w-]{12}$/;

/**
 * A contact card code's fields, for its hosted page and .vcf. Null when there is no such card, or
 * its short link was turned off or blocked, so the page goes down with the code.
 * Cached per request: the page and its metadata both read it.
 */
export const getContactCard = cache(async (publicId: string): Promise<VCardPayload | null> => {
  if (!PUBLIC_ID.test(publicId)) return null;
  const record = await db.query.qrcode.findFirst({
    where: and(eq(qrcode.publicId, publicId), eq(qrcode.payloadType, "vcard")),
    columns: { payloadFields: true },
    with: { link: { columns: { disabled: true, blocked: true } } },
  });
  if (!record?.link || record.link.disabled || record.link.blocked) return null;
  return record.payloadFields?.type === "vcard" ? record.payloadFields : null;
});
