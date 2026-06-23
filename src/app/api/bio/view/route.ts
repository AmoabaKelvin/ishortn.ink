import { geolocation, ipAddress } from "@vercel/functions";
import { and, eq } from "drizzle-orm";
import { type NextRequest } from "next/server";

import { redis } from "@/lib/core/cache";
import { runBackgroundTask } from "@/lib/utils/background";
import { hashIp } from "@/lib/utils/ip-hash";
import { recordBioPageView } from "@/middlewares/record-bio-page-view";
import { db } from "@/server/db";
import { bioPage } from "@/server/db/schema";

const isLocalhost = process.env.NODE_ENV === "development";

export async function POST(request: NextRequest) {
  let bioPageId: unknown;
  try {
    const body = (await request.json()) as { bioPageId?: unknown };
    bioPageId = body?.bioPageId;
  } catch {
    return new Response(null, { status: 400 });
  }

  if (typeof bioPageId !== "number" || !Number.isFinite(bioPageId)) {
    return new Response(null, { status: 400 });
  }

  // Only record for a page that actually exists and is published.
  const page = await db.query.bioPage.findFirst({
    where: and(eq(bioPage.id, bioPageId), eq(bioPage.isPublished, true)),
    columns: { id: true, userId: true },
  });
  if (!page) return new Response(null, { status: 204 });

  const ip = ipAddress(request);

  // Rate-limit: record at most one view per IP per page per minute, so this
  // unauthenticated endpoint can't be spammed to inflate views or drain the
  // page owner's monthly event quota.
  if (ip) {
    const fresh = await redis.set(`biobeacon:${page.id}:${hashIp(ip)}`, "1", "EX", 60, "NX");
    if (fresh !== "OK") return new Response(null, { status: 204 });
  }

  const geo = geolocation(request);

  void runBackgroundTask(
    recordBioPageView({
      headers: request.headers,
      bioPageId: page.id,
      ownerId: page.userId,
      ip: ip ?? "",
      country: geo.country ?? (isLocalhost ? "US" : ""),
      city: geo.city ?? (isLocalhost ? "San Francisco" : ""),
    }),
  );

  return new Response(null, { status: 204 });
}
