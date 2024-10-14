import { eq } from "drizzle-orm";
import crypto from "node:crypto";

import { db } from "@/server/db";
import { subscription, token } from "@/server/db/schema";

export async function validateAndGetToken(apiKey: string | null) {
  if (!apiKey) return null;
  const hash = crypto.createHash("sha256").update(apiKey).digest("hex");
  const existingToken = await db.select().from(token).where(eq(token.token, hash));

  if (!existingToken.length) return null;

  const userSubscription = await db
    .select()
    .from(subscription)
    .where(eq(subscription.userId, existingToken[0]!.userId));

  const data = { ...existingToken[0]!, subscription: userSubscription[0] };

  return data;
}
