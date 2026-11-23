import { eq } from "drizzle-orm";

import { env } from "@/env.mjs";
import { getAppUrl } from "@/lib/constants/domains";
import { logger } from "@/lib/logger";
import { db } from "@/server/db";
import { user } from "@/server/db/schema";
import {
  NOTIFICATION_SETTINGS_PATH,
  parseUnsubscribeList,
  verifyUnsubscribeToken,
  type UnsubscribeList,
} from "@/server/lib/notifications/unsubscribe";

const log = logger.child({ component: "email-unsubscribe" });

const LIST_NAMES = {
  "product-notifications": "product notification emails",
  "weekly-summary": "the weekly summary email",
} satisfies Record<UnsubscribeList, string>;

function readRequest(request: Request) {
  const params = new URL(request.url).searchParams;
  const token = params.get("token");
  const list = parseUnsubscribeList(params.get("list"));
  const secret = env.EMAIL_UNSUBSCRIBE_SECRET;
  const userId = token && secret ? verifyUnsubscribeToken(token, secret, list) : null;
  return { list, userId };
}

// Plain page for people who follow the link in the email footer; one-click POSTs ignore it.
function page(title: string, body: string) {
  const settingsUrl = getAppUrl(NOTIFICATION_SETTINGS_PATH);
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title></head>` +
      `<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111827;max-width:480px;margin:64px auto;padding:0 24px;line-height:1.5">` +
      `<h1 style="font-size:20px;font-weight:600">${title}</h1>${body}` +
      `<p style="font-size:14px;color:#6b7280">Manage all emails in your <a href="${settingsUrl}" style="color:#2563eb">notification settings</a>.</p>` +
      `</body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

// RFC 8058 one-click unsubscribe: mail clients POST here from the
// List-Unsubscribe header without any user interaction.
export async function POST(request: Request) {
  const { list, userId } = readRequest(request);

  if (!userId) {
    return new Response("Invalid unsubscribe link", { status: 400 });
  }

  await db
    .update(user)
    .set(
      list === "weekly-summary" ? { weeklySummaryEnabled: false } : { productEmailsEnabled: false },
    )
    .where(eq(user.id, userId));
  log.info({ userId, list }, "notification emails turned off via one-click unsubscribe");

  return page("You're unsubscribed", `<p>You won't get ${LIST_NAMES[list]} any more.</p>`);
}

// Link scanners prefetch URLs with GET, so GET never changes anything: a valid link shows a
// confirm button that POSTs back to this URL, anything else opens the settings page.
export function GET(request: Request) {
  const { list, userId } = readRequest(request);
  if (!userId) return Response.redirect(getAppUrl(NOTIFICATION_SETTINGS_PATH), 303);

  return page(
    "Unsubscribe",
    `<p>Stop sending ${LIST_NAMES[list]} to this account?</p>` +
      `<form method="post"><button type="submit" style="background:#111827;color:#fff;border:0;border-radius:6px;padding:10px 18px;font-size:15px;cursor:pointer">Unsubscribe</button></form>`,
  );
}
