import { currentUser } from "@clerk/nextjs/server";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

import { logger } from "@/lib/logger";
import { storedName } from "@/lib/utils/user-name";
import { db } from "@/server/db";
import { user } from "@/server/db/schema";

const log = logger.child({ component: "ensure-user" });

export type UserAccess = {
  banned: boolean | null;
  bannedReason: string | null;
  restrictedAt: Date | null;
  isAdmin: boolean | null;
  deletedAt: Date | null;
  name: string | null;
};

type ClerkProfile = {
  firstName: string | null;
  lastName: string | null;
  imageUrl: string;
  primaryEmailAddressId: string | null;
  emailAddresses: { id: string; emailAddress: string }[];
};

/** The User columns ensureUser writes from a Clerk profile; null when it has no email. */
export function profileValues(profile: ClerkProfile) {
  const email =
    profile.emailAddresses.find((e) => e.id === profile.primaryEmailAddressId)?.emailAddress ??
    profile.emailAddresses[0]?.emailAddress;
  // User.email is NOT NULL, so a profile without one cannot get a row.
  if (!email) return null;
  return {
    name: storedName(profile.firstName, profile.lastName),
    email,
    imageUrl: profile.imageUrl,
  };
}

/**
 * Access columns for the signed-in user, creating the User row from the Clerk
 * profile if the webhook has not delivered it (delivery is not guaranteed and
 * never reaches localhost).
 */
export async function ensureUser(userId: string): Promise<UserAccess | undefined> {
  const existing = await db.query.user.findFirst({
    where: eq(user.id, userId),
    columns: {
      banned: true,
      bannedReason: true,
      restrictedAt: true,
      isAdmin: true,
      deletedAt: true,
      name: true,
    },
  });
  if (existing) return existing;

  const profile = await currentUser();
  if (!profile || profile.id !== userId) return undefined;

  const values = profileValues(profile);
  if (!values) {
    log.error({ userId }, "Clerk profile has no email address; cannot provision user row");
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Your account has no email address. Add one in your account settings to continue.",
    });
  }

  // Upsert: the webhook may insert the same row concurrently.
  try {
    await db
      .insert(user)
      // New accounts have nothing above their plan to check (see ensurePlanChecked).
      .values({ id: userId, ...values, planCheckedAt: new Date() })
      .onDuplicateKeyUpdate({ set: values });
  } catch (err) {
    // Every dashboard route depends on this row, so a failure here is a site-wide 500 for the user.
    log.error({ err, userId }, "failed to provision user row from Clerk profile");
    throw err;
  }
  log.info({ userId }, "provisioned user row from Clerk profile");

  return {
    banned: false,
    bannedReason: null,
    restrictedAt: null,
    isAdmin: false,
    deletedAt: null,
    name: values.name,
  };
}
