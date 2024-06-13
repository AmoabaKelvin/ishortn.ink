import crypto from "crypto";
import { eq } from "drizzle-orm";

import { db } from "@/server/db";
import { token } from "@/server/db/schema";

export async function validateAndGetToken(apiKey: string | null) {
  if (!apiKey) return null;
  const hash = crypto.createHash("sha256").update(apiKey).digest("hex");
  const existingToken = await db.select().from(token).where(eq(token.token, hash));
  return existingToken.length ? existingToken[0] : null;
}
