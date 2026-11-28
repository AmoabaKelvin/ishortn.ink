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
import { unsubscribeReportRecipient } from "@/server/lib/scheduled-reports";

import {
  CONFIRM_FORM_FIELD,
  renderUnsubscribePage,
  type UnsubscribePageState,
} from "./unsubscribe-page";

const log = logger.child({ component: "email-unsubscribe" });

function readRequest(request: Request) {
  const params = new URL(request.url).searchParams;
  const token = params.get("token");
  const list = parseUnsubscribeList(params.get("list"));
  const secret = env.EMAIL_UNSUBSCRIBE_SECRET;
  // The user id, or the report recipient id on scheduled-report links.
  const id = token && secret ? verifyUnsubscribeToken(token, secret, list) : null;
  return { list, id };
}

function page(state: UnsubscribePageState, list: UnsubscribeList, status = 200) {
  return new Response(renderUnsubscribePage(state, list, getAppUrl(NOTIFICATION_SETTINGS_PATH)), {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

const plain = (body: string, status = 200) =>
  new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

// RFC 8058 one-click unsubscribe: mail clients POST here from the List-Unsubscribe header without
// any user interaction (urlencoded or multipart) and get a plain response. The confirm form on
// the GET page marks its POST so the person sees the HTML confirmation instead.
export async function POST(request: Request) {
  const { list, id } = readRequest(request);
  const fromPage = (await request.text()).includes(CONFIRM_FORM_FIELD);

  if (!id) {
    return fromPage ? page("invalid", list, 400) : plain("Invalid unsubscribe link", 400);
  }

  if (list === "scheduled-report") {
    await unsubscribeReportRecipient(id);
    log.info({ list, fromPage }, "report recipient unsubscribed via unsubscribe link");
  } else {
    await db
      .update(user)
      .set(
        list === "weekly-summary"
          ? { weeklySummaryEnabled: false }
          : { productEmailsEnabled: false },
      )
      .where(eq(user.id, id));
    log.info({ userId: id, list, fromPage }, "notification emails turned off via unsubscribe link");
  }

  return fromPage ? page("done", list) : plain("Unsubscribed");
}

// Link scanners prefetch URLs with GET, so GET never changes anything: it only asks for
// confirmation, and needs no sign-in.
export function GET(request: Request) {
  const { list, id } = readRequest(request);
  return id ? page("confirm", list) : page("invalid", list, 400);
}
