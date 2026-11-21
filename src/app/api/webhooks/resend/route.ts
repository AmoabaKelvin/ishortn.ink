import { Webhook } from "svix";

import { env } from "@/env.mjs";
import { logger } from "@/lib/logger";
import { applySuppressionAction } from "@/server/lib/notifications/suppression";
import {
  resendEmailEventSchema,
  suppressionActionFor,
} from "@/server/lib/notifications/suppression-event";

const log = logger.child({ webhook: "resend" });

// Subscribed events: email.bounced, email.complained, email.delivered. Resend (svix) retries
// non-2xx deliveries, and every write here is idempotent, so a retry is safe.
export async function POST(request: Request) {
  const secret = env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    log.error("RESEND_WEBHOOK_SECRET is not set");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing signature", { status: 401 });
  }

  // Verify the raw body: re-serialising parsed JSON can change bytes and break the signature.
  const rawBody = await request.text();
  let payload: unknown;
  try {
    payload = new Webhook(secret).verify(rawBody, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
  } catch {
    return new Response("Invalid signature", { status: 401 });
  }

  const event = resendEmailEventSchema.safeParse(payload);
  if (!event.success) {
    log.warn({ svixId, issues: event.error.issues }, "unexpected webhook payload");
    return new Response("Unexpected payload", { status: 400 });
  }

  const action = suppressionActionFor(event.data, new Date());
  if (action.kind === "ignore") return new Response(null, { status: 204 });

  await applySuppressionAction(action);
  if (action.kind === "suppress") {
    log.info({ type: action.type, count: action.emails.length }, "suppressed email addresses");
  }
  return new Response(null, { status: 204 });
}
