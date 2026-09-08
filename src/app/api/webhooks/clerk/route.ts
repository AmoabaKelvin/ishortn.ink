import { headers } from "next/headers";
import { Webhook } from "svix";
import { z } from "zod";

import { env } from "@/env.mjs";
import WelcomeEmail from "@/lib/email/templates/welcome-email";
import { logger } from "@/lib/logger";
import { db } from "@/server/db";
import { user } from "@/server/db/schema";
import { resend } from "@/server/lib/notifications/resend-client";

const log = logger.child({ webhook: "clerk" });

export async function POST(req: Request) {
  // You can find this in the Clerk Dashboard -> Webhooks -> choose the webhook
  const WEBHOOK_SECRET = env.WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error("Please add WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local");
  }

  // Get the headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Error occured -- no svix headers", {
      status: 400,
    });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Create a new SVIX instance with your secret.
  const wh = new Webhook(WEBHOOK_SECRET);

  // Verify the payload with the headers
  try {
    wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    });
  } catch (err) {
    log.error({ err }, "signature verification failed");
    return new Response("Error occured", {
      status: 400,
    });
  }

  const event = clerkUserEventSchema.safeParse(payload);
  if (!event.success) {
    log.error({ issues: event.error.issues }, "unexpected webhook payload");
    return new Response("Unexpected payload", { status: 400 });
  }

  // Get the ID and type
  const { id } = event.data.data;
  const eventType = event.data.type;

  log.debug({ eventId: id, eventType }, "webhook received");

  // Get the user info
  const userInfo = getUserInfo(event.data);

  // Upsert: ensure-user may have created the row on the user's first request.
  const values = {
    name: userInfo.name,
    email: userInfo.email,
    imageUrl: userInfo.avatarUrl,
  };
  await db
    .insert(user)
    .values({ id, ...values })
    .onDuplicateKeyUpdate({ set: values });

  if (resend) {
    const { error } = await resend.emails.send({
      from: "Kelvin <developer@ishortn.ink>",
      to: userInfo.email!,
      subject: "Welcome to iShortn",
      react: WelcomeEmail({
        userFirstname: userInfo.name.split(" ")[0] ?? "there",
      }),
    });

    if (error) {
      log.error({ err: error, eventId: id, eventType }, "failed to send welcome email");
    }
  }

  return new Response("", { status: 201 });
}

const clerkUserEventSchema = z.object({
  type: z.string(),
  data: z.object({
    id: z.string(),
    first_name: z.string().nullable(),
    last_name: z.string().nullable(),
    image_url: z.string(),
    email_addresses: z.array(z.object({ email_address: z.string() })),
  }),
});

type ClerkUserEvent = z.infer<typeof clerkUserEventSchema>;

function getUserInfo(payload: ClerkUserEvent) {
  const data = payload.data;
  const emailData = data.email_addresses[0];

  const userInfo = {
    name: `${data.first_name} ${data.last_name}`,
    email: emailData?.email_address,
    avatarUrl: data.image_url,
  };

  return userInfo;
}
