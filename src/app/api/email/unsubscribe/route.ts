import { eq } from "drizzle-orm";

import { env } from "@/env.mjs";
import { getAppUrl } from "@/lib/constants/domains";
import { logger } from "@/lib/logger";
import { db } from "@/server/db";
import { user } from "@/server/db/schema";
import {
  NOTIFICATION_SETTINGS_PATH,
  verifyUnsubscribeToken,
} from "@/server/lib/notifications/unsubscribe";

const log = logger.child({ component: "email-unsubscribe" });

// RFC 8058 one-click unsubscribe: mail clients POST here from the
// List-Unsubscribe header without any user interaction.
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  const secret = env.EMAIL_UNSUBSCRIBE_SECRET;
  const userId = token && secret ? verifyUnsubscribeToken(token, secret) : null;

  if (!userId) {
    return new Response("Invalid unsubscribe link", { status: 400 });
  }

  await db.update(user).set({ productEmailsEnabled: false }).where(eq(user.id, userId));
  log.info({ userId }, "product notification emails turned off via one-click unsubscribe");

  return new Response("You have been unsubscribed from product notification emails.");
}

// Link scanners prefetch URLs with GET, so GET never changes anything; it opens the settings page.
export function GET() {
  return Response.redirect(getAppUrl(NOTIFICATION_SETTINGS_PATH), 303);
}
