import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { generateShortLink } from "@/lib/core/links";
import { fetchMetadataInfo } from "@/lib/utils/fetch-link-metadata";
import { detectPhishingLink } from "@/server/api/routers/ai/ai.service";
import { db } from "@/server/db";
import { link } from "@/server/db/schema";

import { validateAndGetToken } from "../utils";

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

  if (input.data.alias && (await checkLinkAliasCollision(input.data.alias, input.data.domain))) {
    return new Response("Alias already exists", { status: 400 });
  }

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

const shortenLinkSchema = z.object({
  url: z.string().url(),
  expiresAt: z.string().optional(),
  expiresAfter: z.number().optional(),
  alias: z.string().optional(),
  password: z.string().optional(),
  domain: z.string().optional(),
});

async function checkLinkAliasCollision(alias: string, domain: string | undefined) {
  const domainToUse = domain ?? "ishortn.ink";
  const existingLink = await db
    .select()
    .from(link)
    .where(and(eq(link.alias, alias), eq(link.domain, domainToUse)));
  return existingLink.length > 0;
}

async function createNewLink(
  data: z.infer<typeof shortenLinkSchema>,
  userId: string,
  subStatus: string | undefined | null,
) {
  if (data.password) {
    if (subStatus !== "active" || subStatus === undefined) {
      throw new Error("You need to upgrade to a pro plan to use password protection");
    }

    const hashedPassword = bcrypt.hashSync(data.password, 10);
    data.password = hashedPassword;
  }

  const aliasRegex = /^[a-zA-Z0-9-_]+$/;
  if (data.alias && !aliasRegex.test(data.alias ?? "")) {
    throw new Error("Alias can only contain alphanumeric characters, dashes, and underscores");
  }

  // check for phishing
  const phishingResult = await detectPhishingLink(data.url, await fetchMetadataInfo(data.url));
  if (phishingResult.phishing) {
    throw new Error(
      "This URL has been detected as a potential phishing site. Shortened link will not be created.",
    );
  }

  const newLinkData = {
    url: data.url,
    alias: data.alias ?? (await generateShortLink()),
    disableLinkAfterClicks: data.expiresAfter,
    disableLinkAfterDate: data.expiresAt ? new Date(data.expiresAt) : null,
    passwordHash: data.password,
    domain: data.domain ?? "ishortn.ink",
    userId,
  };

  const newLink = await db.insert(link).values(newLinkData);
  const newLinkId = newLink[0].insertId;

  const retrievedLink = await db.select().from(link).where(eq(link.id, newLinkId));
  return {
    shortLink: `https://${retrievedLink[0]!.domain}/${retrievedLink[0]!.alias}`,
    url: retrievedLink[0]!.url,
    alias: retrievedLink[0]!.alias,
    expiresAt: retrievedLink[0]!.disableLinkAfterDate,
    expiresAfter: retrievedLink[0]!.disableLinkAfterClicks,
    isProtected: !!retrievedLink[0]!.passwordHash,
  };
}
