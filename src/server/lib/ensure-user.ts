import { currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";

import { logger } from "@/lib/logger";
import { db } from "@/server/db";
import { user } from "@/server/db/schema";

const log = logger.child({ component: "ensure-user" });

export type UserAccess = {
  banned: boolean | null;
  bannedReason: string | null;
  isAdmin: boolean | null;
};

/**
 * Access columns for the signed-in user, creating the User row from the Clerk
 * profile if the webhook has not delivered it (delivery is not guaranteed and
 * never reaches localhost).
 */
export async function ensureUser(userId: string): Promise<UserAccess | undefined> {
  const existing = await db.query.user.findFirst({
    where: eq(user.id, userId),
    columns: { banned: true, bannedReason: true, isAdmin: true },
  });
  if (existing) return existing;

  const profile = await currentUser();
  if (!profile || profile.id !== userId) return undefined;

  const primaryEmail =
    profile.emailAddresses.find((e) => e.id === profile.primaryEmailAddressId)?.emailAddress ??
    profile.emailAddresses[0]?.emailAddress;
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ") || null;

  // Upsert: the webhook may insert the same row concurrently.
  await db
    .insert(user)
    .values({ id: userId, name, email: primaryEmail, imageUrl: profile.imageUrl })
    .onDuplicateKeyUpdate({ set: { name, email: primaryEmail, imageUrl: profile.imageUrl } });
  log.info({ userId }, "provisioned user row from Clerk profile");

  return { banned: false, bannedReason: null, isAdmin: false };
}
