import { z } from "zod";

import { storedName } from "@/lib/utils/user-name";

export const clerkUserDeletedEventSchema = z.object({
  type: z.literal("user.deleted"),
  data: z.object({ id: z.string() }),
});

export const clerkUserEventSchema = z.object({
  type: z.string(),
  data: z.object({
    id: z.string(),
    first_name: z.string().nullable(),
    last_name: z.string().nullable(),
    image_url: z.string(),
    primary_email_address_id: z.string().nullish(),
    email_addresses: z.array(z.object({ id: z.string().optional(), email_address: z.string() })),
  }),
});

type ClerkUserEvent = z.infer<typeof clerkUserEventSchema>;

/** The User columns from a Clerk user event; null when the user has no email address. */
export function getUserInfo(payload: ClerkUserEvent) {
  const data = payload.data;
  // The primary address, so a changed email (user.updated) replaces the stored one.
  const email =
    data.email_addresses.find((e) => e.id === data.primary_email_address_id)?.email_address ??
    data.email_addresses[0]?.email_address;
  // User.email is NOT NULL, so a user without one cannot get a row.
  if (!email) return null;

  return {
    name: storedName(data.first_name, data.last_name),
    email,
    avatarUrl: data.image_url,
  };
}
