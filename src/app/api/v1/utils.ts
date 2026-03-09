import { eq } from "drizzle-orm";
import crypto from "node:crypto";

import { db } from "@/server/db";
import { subscription, token, user } from "@/server/db/schema";

export async function validateAndGetToken(apiKey: string | null) {
  if (!apiKey) return null;
  const hash = crypto.createHash("sha256").update(apiKey).digest("hex");
  const existingToken = await db.select().from(token).where(eq(token.token, hash));

  if (!existingToken.length) return null;

  const userId = existingToken[0]!.userId;

  // Run ban check and subscription lookup in parallel
  const [userRecord, userSubscription] = await Promise.all([
    db.query.user.findFirst({
      where: eq(user.id, userId),
      columns: { banned: true },
    }),
    db.select().from(subscription).where(eq(subscription.userId, userId)),
  ]);

  if (userRecord?.banned) {
    return null;
  }

  return { ...existingToken[0]!, subscription: userSubscription[0] };
}
