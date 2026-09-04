import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { setStringIfAbsent } from "@/lib/core/cache";
import { getClientIp, getRequestGeo } from "@/lib/platform";
import { runBackgroundTask } from "@/lib/utils/background";
import { hashIp } from "@/lib/utils/ip-hash";
import { recordBioPageView } from "@/middlewares/record-bio-page-view";
import { db } from "@/server/db";
import { bioPage } from "@/server/db/schema";

import type { NextRequest } from "next/server";

const isLocalhost = process.env.NODE_ENV === "development";

const bioViewSchema = z.object({ bioPageId: z.number() });

export async function POST(request: NextRequest) {
  const input = bioViewSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) {
    return new Response(null, { status: 400 });
  }
  const { bioPageId } = input.data;

  // Only record for a page that actually exists and is published.
  const page = await db.query.bioPage.findFirst({
    where: and(eq(bioPage.id, bioPageId), eq(bioPage.isPublished, true)),
    columns: { id: true, userId: true },
  });
  if (!page) return new Response(null, { status: 204 });

  const ip = getClientIp(request.headers);

  // Rate-limit: record at most one view per IP per page per minute, so this
  // unauthenticated endpoint can't be spammed to inflate views or drain the
  // page owner's monthly event quota.
  if (ip) {
    const fresh = await setStringIfAbsent(`biobeacon:${page.id}:${hashIp(ip)}`, "1", 60);
    if (!fresh) return new Response(null, { status: 204 });
  }

  const geo = getRequestGeo();

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
