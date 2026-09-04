import { z } from "zod";

import { verifyVerifiedClickToken } from "@/lib/utils/verified-click-token";
import { enqueueClickEvent } from "@/server/lib/click-queue";

import type { NextRequest } from "next/server";

const verifyClickSchema = z.object({ token: z.string().min(1) });

export async function POST(request: NextRequest): Promise<Response> {
  const input = verifyClickSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return new Response(null, { status: 400 });

  const decoded = verifyVerifiedClickToken(input.data.token);
  if (!decoded) return new Response(null, { status: 400 });

  await enqueueClickEvent({
    kind: "verify",
    visitId: decoded.visitId,
    verifiedAt: new Date().toISOString(),
  });
  return new Response(null, { status: 202 });
}
