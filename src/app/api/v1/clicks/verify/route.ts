import { and, eq, isNull, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";

import { verifyVerifiedClickToken } from "@/lib/utils/verified-click-token";
import { db } from "@/server/db";
import { linkVisit } from "@/server/db/schema";

// Retry covers the race where the beacon lands before `recordClick` (running
// in waitUntil) has inserted the row. Missed verifications are acceptable
// noise; missed rows past the retry budget are dropped.
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 300;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function markVerified(visitId: string): Promise<boolean> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const [result] = await db
      .update(linkVisit)
      .set({ verifiedAt: sql`CURRENT_TIMESTAMP` })
      .where(and(eq(linkVisit.visitId, visitId), isNull(linkVisit.verifiedAt)));

    if ((result?.affectedRows ?? 0) > 0) return true;
    if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS);
  }
  return false;
}

export async function POST(request: NextRequest): Promise<Response> {
  let token: string | null = null;
  try {
    const body = (await request.json()) as { token?: unknown };
    if (typeof body.token === "string") token = body.token;
  } catch {
    // fall through — token stays null
  }

  if (!token) return new Response(null, { status: 400 });

  const decoded = verifyVerifiedClickToken(token);
  if (!decoded) return new Response(null, { status: 400 });

  // 202 rather than a non-2xx when the row hasn't landed after retries — keeps
  // browsers from retrying and the request was semantically valid.
  return new Response(null, {
    status: (await markVerified(decoded.visitId)) ? 204 : 202,
  });
}
