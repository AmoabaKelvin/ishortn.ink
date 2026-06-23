import { geolocation, ipAddress } from "@vercel/functions";
import { and, eq } from "drizzle-orm";
import { type NextRequest } from "next/server";

import { runBackgroundTask } from "@/lib/utils/background";
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

  const geo = geolocation(request);
  const ip = ipAddress(request);

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
