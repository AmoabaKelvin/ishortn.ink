import { NextResponse } from "next/server";
import { z } from "zod";

import { type ClickEvent, clickEventSchema } from "@/lib/core/analytics/click-event";
import { logger } from "@/lib/logger";
import { ingestClickBatch } from "@/server/lib/click-ingest";
import { isInternalRequest } from "@/server/lib/internal-request";

const log = logger.child({ job: "click-queue" });

// Consumer for CLICK_QUEUE, called by the Worker's queue handler with the
// batch's message bodies. Unparseable messages are logged and dropped.
export async function POST(request: Request) {
  if (!isInternalRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const batch = z.array(z.unknown()).safeParse(await request.json().catch(() => null));
  if (!batch.success) {
    return NextResponse.json({ error: "Malformed batch" }, { status: 400 });
  }

  const events: ClickEvent[] = [];
  for (const body of batch.data) {
    const parsed = clickEventSchema.safeParse(body);
    if (parsed.success) events.push(parsed.data);
    else log.error({ issues: parsed.error.issues }, "dropping unparseable click event");
  }

  await ingestClickBatch(events);
  return new Response(null, { status: 204 });
}
