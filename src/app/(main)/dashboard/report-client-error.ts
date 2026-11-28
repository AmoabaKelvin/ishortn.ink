"use server";

import { auth } from "@clerk/nextjs/server";

import { logger } from "@/lib/logger";

import { clientErrorReportInput } from "./_lib/client-error-report";

import type { ClientErrorReportInput } from "./_lib/client-error-report";

const log = logger.child({ component: "client-error-boundary" });

/**
 * Error boundaries run in the browser, so what they catch never reaches the Worker's logs on its
 * own; this writes it there. Signed-in sessions only, so the action can't be used to flood logs
 * anonymously. Parsed again here: a server action's arguments come straight from the browser.
 */
export async function reportClientError(report: ClientErrorReportInput) {
  const { userId } = await auth();
  if (!userId) return;
  const parsed = clientErrorReportInput.safeParse(report);
  if (!parsed.success) return;
  log.error({ ...parsed.data, userId }, "error boundary caught a render error");
}
