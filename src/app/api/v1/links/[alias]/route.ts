import { and, eq } from "drizzle-orm";

import { db } from "@/server/db";
import { link } from "@/server/db/schema";

import { validateAndGetToken } from "../../utils";

import type { NextRequest } from "next/server";

export async function GET(request: NextRequest, { params }: { params: { alias: string } }) {
  const alias = params.alias;
  const apiKey = request.headers.get("x-api-key");

  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('domain')
  const domain = query ?? "ishortn.ink"

  const token = await validateAndGetToken(apiKey);
  if (!token) {
    return new Response("Invalid or missing API key", { status: 401 });
  }

  const retrievedLink = await getLinkByAlias(alias, domain);
  if (!retrievedLink) {
    return new Response("Link not found", { status: 404 });
  }

  return Response.json(retrievedLink);
}

async function getLinkByAlias(alias: string, domain: string) {
  const retrievedLink = await db.select().from(link).where(and(eq(link.alias, alias), eq(link.domain, domain)));
  if (!retrievedLink.length) return null;

  return {
    shortLink: `https://${retrievedLink[0]!.domain}/${retrievedLink[0]!.alias}`,
    url: retrievedLink[0]!.url,
    alias: retrievedLink[0]!.alias,
    expiresAt: retrievedLink[0]!.disableLinkAfterDate,
    expiresAfter: retrievedLink[0]!.disableLinkAfterClicks,
  };
}
