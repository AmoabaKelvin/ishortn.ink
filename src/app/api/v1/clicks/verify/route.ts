import type { NextRequest } from "next/server";

import { verifyVerifiedClickToken } from "@/lib/utils/verified-click-token";
import { enqueueClickEvent } from "@/server/lib/click-queue";

export async function POST(request: NextRequest): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { token?: unknown } | null;
  const token = typeof body?.token === "string" ? body.token : null;
  if (!token) return new Response(null, { status: 400 });

  const decoded = verifyVerifiedClickToken(token);
  if (!decoded) return new Response(null, { status: 400 });

  await enqueueClickEvent({
    kind: "verify",
    visitId: decoded.visitId,
    verifiedAt: new Date().toISOString(),
  });
  return new Response(null, { status: 202 });
}
