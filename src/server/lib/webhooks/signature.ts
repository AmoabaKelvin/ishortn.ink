import { createHmac, randomBytes } from "node:crypto";

export const WEBHOOK_SIGNATURE_HEADER = "X-iShortn-Signature";

/** A new per-endpoint signing secret. */
export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString("hex")}`;
}

/**
 * The X-iShortn-Signature value: `t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<body>">`.
 * Signing the timestamp with the body lets receivers reject replays of an old delivery.
 * content/docs/integrations/webhooks.mdx documents the verification side.
 */
export function signWebhookPayload(secret: string, body: string, timestampSeconds: number): string {
  const digest = createHmac("sha256", secret).update(`${timestampSeconds}.${body}`).digest("hex");
  return `t=${timestampSeconds},v1=${digest}`;
}
