import { eq } from "drizzle-orm";

import { db } from "@/server/db";
import { link } from "@/server/db/schema";

import { validateAndGetToken } from "../../utils";

import type { NextRequest } from "next/server";

export async function GET(request: NextRequest, { params }: { params: { alias: string } }) {
  const alias = params.alias;
  const apiKey = request.headers.get("x-api-key");

  const token = await validateAndGetToken(apiKey);
  if (!token) {
    return new Response("Invalid or missing API key", { status: 401 });
  }

  const retrievedLink = await getLinkByAlias(alias);
  if (!retrievedLink) {
    return new Response("Link not found", { status: 404 });
  }

  return Response.json(retrievedLink);
}

async function getLinkByAlias(alias: string) {
  const retrievedLink = await db.select().from(link).where(eq(link.alias, alias));
  if (!retrievedLink.length) return null;
  return {
    shortLink: `https://ishortn.ink/${retrievedLink[0]!.alias}`,
    url: retrievedLink[0]!.url,
    alias: retrievedLink[0]!.alias,
    expiresAt: retrievedLink[0]!.disableLinkAfterDate,
    expiresAfter: retrievedLink[0]!.disableLinkAfterClicks,
  };
}
