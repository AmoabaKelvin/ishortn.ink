import { NextResponse } from "next/server";

import { getClientIp } from "@/lib/platform";
import { hashIp } from "@/lib/utils/ip-hash";
import { subscribeSchema } from "@/server/api/routers/bio-page/bio-page.input";
import { subscribeToBioPage } from "@/server/api/routers/bio-page/bio-page.service";
import { db } from "@/server/db";

const respond = (body: { ok: boolean; error?: string }, status: number, headers?: HeadersInit) =>
  NextResponse.json(body, { status, headers: { "cache-control": "no-store", ...headers } });

// Email signup blocks on bio pages post here. Same-origin on ishortn.ink and on
// custom domains, like the view beacon.
export async function POST(request: Request) {
  const input = subscribeSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return respond({ ok: false, error: "Enter a valid email address." }, 400);

  const result = await subscribeToBioPage(db, input.data, {
    ipHash: hashIp(getClientIp(request.headers) ?? "unknown"),
  });
  if (result.ok) return respond({ ok: true }, 200);
  return respond(
    { ok: false, error: result.error },
    result.status,
    result.retryAfter ? { "Retry-After": String(result.retryAfter) } : undefined,
  );
}
