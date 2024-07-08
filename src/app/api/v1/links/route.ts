import bcrypt from "bcryptjs";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { generateShortLink } from "@/lib/core/links";
import { db } from "@/server/db";
import { link, subscription, token } from "@/server/db/schema";

import type { NextRequest } from "next/server";

export async function POST(request: Request) {
  const apiKey = request.headers.get("x-api-key");
  const token = await validateAndGetToken(apiKey);
  if (!token) {
    return new Response("Invalid or missing API key", { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const body = await request.json();
  const input = shortenLinkSchema.safeParse(body);

  if (!input.success) {
    return new Response(input.error.message, { status: 400 });
  }

  if (input.data.alias && (await checkLinkAliasCollision(input.data.alias))) {
    return new Response("Alias already exists", { status: 400 });
  }

  // const newLink = await createNewLink(input.data, token.userId, token.subscription?.status);
  // return new Response(JSON.stringify(newLink), {
  //   status: 201,
  //   headers: { "Content-Type": "application/json" },
  // });

  try {
    const newLink = await createNewLink(input.data, token.userId, token.subscription?.status);
    return new Response(JSON.stringify(newLink), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof Error) {
      return new Response(error.message, { status: 400 });
    }
    return new Response("An error occurred", { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  const token = await validateAndGetToken(apiKey);
  if (!token) {
    return new Response("Invalid or missing API key", { status: 401 });
  }

  const linkId = request.nextUrl.searchParams.get("alias");
  if (!linkId) {
    return new Response("Missing alias parameter", { status: 400 });
  }

  const retrievedLink = await getLinkByAlias(linkId);
  if (!retrievedLink) {
    return new Response("Link not found", { status: 404 });
  }

  return Response.json(retrievedLink);
}

const shortenLinkSchema = z.object({
  url: z.string().url(),
  expiresAt: z.string().optional(),
  expiresAfter: z.number().optional(),
  alias: z.string().optional(),
  password: z.string().optional(),
});

async function checkLinkAliasCollision(alias: string) {
  const existingLink = await db.select().from(link).where(eq(link.alias, alias));
  return existingLink.length > 0;
}

async function createNewLink(
  data: z.infer<typeof shortenLinkSchema>,
  userId: string,
  subStatus: string | undefined | null,
) {
  // check if there is a password

  if (data.password) {
    if (subStatus !== "active" || subStatus === undefined) {
      throw new Error("You need to upgrade to a pro plan to use password protection");
    }

    const hashedPassword = bcrypt.hashSync(data.password, 10);
    data.password = hashedPassword;
  }

  const newLinkData = {
    url: data.url,
    alias: data.alias ?? (await generateShortLink()),
    disableLinkAfterClicks: data.expiresAfter,
    disableLinkAfterDate: data.expiresAt ? new Date(data.expiresAt) : null,
    passwordHash: data.password,
    userId,
  };

  const newLink = await db.insert(link).values(newLinkData);
  const newLinkId = newLink[0].insertId;

  const retrievedLink = await db.select().from(link).where(eq(link.id, newLinkId));
  return {
    shortLink: `https://ishortn.ink/${retrievedLink[0]!.alias}`,
    url: retrievedLink[0]!.url,
    alias: retrievedLink[0]!.alias,
    expiresAt: retrievedLink[0]!.disableLinkAfterDate,
    expiresAfter: retrievedLink[0]!.disableLinkAfterClicks,
    isProtected: !!retrievedLink[0]!.passwordHash,
  };
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

async function validateAndGetToken(apiKey: string | null) {
  if (!apiKey) return null;
  const hash = crypto.createHash("sha256").update(apiKey).digest("hex");
  const existingToken = await db.select().from(token).where(eq(token.token, hash));

  if (!existingToken.length) return null;

  const userSubscription = await db
    .select()
    .from(subscription)
    .where(eq(subscription.userId, existingToken[0]!.userId));

  // add the user subscription to the token object
  // existingToken[0]!.subscription = userSubscription[0];
  const data = { ...existingToken[0]!, subscription: userSubscription[0] };

  return data;
}
