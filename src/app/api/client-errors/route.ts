import { auth } from "@clerk/nextjs/server";
import { type NextRequest, NextResponse } from "next/server";

import { clientErrorReportInput } from "@/app/(main)/dashboard/_lib/client-error-report";
import { logger } from "@/lib/logger";

const log = logger.child({ component: "client-error-boundary" });

// Well above one capped report; anything bigger isn't from our boundaries.
const BODY_MAX = 16_000;

export const dynamic = "force-dynamic";

/**
 * Error boundaries run in the browser, so what they catch never reaches the Worker's logs on its
 * own; this writes it there. A route handler rather than a server action: action ids change with
 * every build, so a tab left on the previous build (the version-skew crashes most worth seeing)
 * couldn't reach an action. Signed-in sessions only, so it can't be used to flood logs anonymously.
 */
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return new NextResponse(null, { status: 401 });

  const body = await request.text();
  if (body.length > BODY_MAX) return new NextResponse(null, { status: 413 });

  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const parsed = clientErrorReportInput.safeParse(json);
  if (!parsed.success) return new NextResponse(null, { status: 400 });

  log.error({ ...parsed.data, userId }, "error boundary caught a render error");
  return new NextResponse(null, { status: 204 });
}
