import { and, eq } from "drizzle-orm";

import { db } from "@/server/db";
import { link } from "@/server/db/schema";

import { validateAndGetToken } from "../../utils";

import type { NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { alias: string } }
) {
  const alias = params.alias;
  const apiKey = request.headers.get("x-api-key");

  console.log("api key", apiKey);

  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("domain");
  const domain = query ?? "ishortn.ink";

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: { alias: string } }
) {
  const alias = params.alias;
  const apiKey = request.headers.get("x-api-key");

  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("domain");
  const domain = query ?? "ishortn.ink";

  const token = await validateAndGetToken(apiKey);
  if (!token) {
    return new Response("Invalid or missing API key", { status: 401 });
  }

  let updateData: {
    url?: string;
    alias?: string;
    disableLinkAfterDate?: Date | null;
    disableLinkAfterClicks?: number | null;
  };
  try {
    updateData = await request.json();
  } catch (error) {
    return new Response("Invalid request body", { status: 400 });
  }

  const existingLink = await getLinkByAlias(alias, domain);
  if (!existingLink) {
    return new Response("Link not found", { status: 404 });
  }

  // Filter out undefined values from updateData
  const filteredUpdateData = Object.entries(updateData).reduce(
    (acc, [key, value]) => {
      if (value !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
        (acc as any)[key] = value;
      }
      return acc;
    },
    {} as typeof updateData
  );

  if (Object.keys(filteredUpdateData).length === 0) {
    return new Response("No update fields provided", { status: 400 });
  }

  try {
    await db
      .update(link)
      .set(filteredUpdateData)
      .where(and(eq(link.alias, alias), eq(link.domain, domain)));

    // Fetch the updated link data to return
    const updatedAlias = filteredUpdateData.alias ?? alias; // Use new alias if provided
    const updatedLink = await getLinkByAlias(updatedAlias, domain);

    if (!updatedLink) {
      // This case should ideally not happen if the update was successful and alias wasn't changed
      // Or if it was changed, the fetch used the new alias
      return new Response("Failed to retrieve updated link", { status: 500 });
    }

    return Response.json(updatedLink);
  } catch (error) {
    console.error("Failed to update link:", error);
    // Consider more specific error handling (e.g., duplicate alias if changed)
    return new Response("Failed to update link", { status: 500 });
  }
}

async function getLinkByAlias(alias: string, domain: string) {
  const retrievedLink = await db
    .select()
    .from(link)
    .where(and(eq(link.alias, alias), eq(link.domain, domain)));
  if (!retrievedLink.length) return null;

  return {
    shortLink: `https://${retrievedLink[0]!.domain}/${retrievedLink[0]!.alias}`,
    url: retrievedLink[0]!.url,
    alias: retrievedLink[0]!.alias,
    expiresAt: retrievedLink[0]!.disableLinkAfterDate,
    expiresAfter: retrievedLink[0]!.disableLinkAfterClicks,
  };
}
