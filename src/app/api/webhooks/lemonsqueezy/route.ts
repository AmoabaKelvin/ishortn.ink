import { eq } from "drizzle-orm";
import crypto from "node:crypto";
import { Resend } from "resend";

import WelcomeEmail from "@/emails/welcome-to-pro";
import { webhookHasMeta } from "@/lib/typeguards";
import { db } from "@/server/db";
import { subscription } from "@/server/db/schema";

import type {
  LemonsqueezySubscriptionAttributes,
  LemonsqueezyWebhookPayload,
} from "@/lib/types/lemonsqueezy";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  if (!process.env.LEMONSQUEEZY_WEBHOOK_SECRET) {
    return new Response("Lemon Squeezy Webhook Secret not set in .env", {
      status: 500,
    });
  }

  // First, make sure the request is from Lemon Squeezy.
  const rawBody = await request.text();
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;

  const hmac = crypto.createHmac("sha256", secret);
  const digest = Buffer.from(hmac.update(rawBody).digest("hex"), "utf8");
  const signature = Buffer.from(request.headers.get("X-Signature") ?? "", "utf8");

  if (!crypto.timingSafeEqual(digest, signature)) {
    throw new Error("Invalid signature.");
  }

  const data = JSON.parse(rawBody) as LemonsqueezyWebhookPayload;

  if (!webhookHasMeta(data)) {
    return new Response("Webhook does not have meta", {
      status: 400,
    });
  }

  void processWebhook(data);

  return new Response("OK", { status: 200 });
}

async function processWebhook(webhookEvent: LemonsqueezyWebhookPayload) {
  const { meta, data } = webhookEvent;
  const { event_name, custom_data } = meta;
  const { user_id: userId } = custom_data;
  const subscriptionId = Number.parseInt(data.id);

  const lemonsqueezySubscription = data.attributes as LemonsqueezySubscriptionAttributes;
  const customerId = lemonsqueezySubscription.customer_id;
  const orderId = lemonsqueezySubscription.order_id;
  const renewsAt = new Date(lemonsqueezySubscription.renews_at);
  const createdAt = new Date(lemonsqueezySubscription.created_at);
  const endsAt = lemonsqueezySubscription.ends_at;
  const status = lemonsqueezySubscription.status;

  // payment data
  const cardBrand = lemonsqueezySubscription.card_brand;
  const cardLastFour = lemonsqueezySubscription.card_last_four;

  if (event_name === "subscription_created") {
    const user = await db.query.user.findFirst({
      where: (table, { eq }) => eq(table.id, userId),
    });

    if (!user) {
      return;
    }

    await db
      .insert(subscription)
      .values({
        userId: userId,
        subscriptionId,
        customerId,
        orderId,
        status,
        cardBrand,
        cardLastFour,
        renewsAt: new Date(renewsAt),
        createdAt: new Date(createdAt),
        endsAt: endsAt ? new Date(endsAt) : null,
      })
      .onDuplicateKeyUpdate({
        set: {
          status,
          cardBrand,
          cardLastFour,
          renewsAt: new Date(renewsAt),
          endsAt: endsAt ? new Date(endsAt) : null,
        },
      });

    const email = user.email;
    const name = user.name;

    await resend.emails.send({
      from: "Kelvin <kelvin@ishortn.ink>",
      to: email!,
      subject: "Welcome to iShortn Pro",
      react: WelcomeEmail({ userName: name ?? "there" }),
    });
  } else if (event_name === "subscription_updated") {
    // handle subscription updated. Sent when a subscription is updated

    await db
      .update(subscription)
      .set({
        status,
        renewsAt: renewsAt ? new Date(renewsAt) : null,
        endsAt: endsAt ? new Date(endsAt) : null,
        cardBrand,
        cardLastFour,
      })
      .where(eq(subscription.userId, userId));
  } else if (event_name === "subscription_expired") {
    await db
      .update(subscription)
      .set({
        status,
        endsAt: new Date(), // set endsAt to now to indicate the subscription has ended
      })
      .where(eq(subscription.userId, userId));
  } else if (event_name === "order_created") {
    // handle order created
  }
}
