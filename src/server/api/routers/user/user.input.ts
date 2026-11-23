import { z } from "zod";

export const updateUserProfileSchema = z.object({
  name: z.string().min(1, "Name is required").max(255, "Name is too long"),
});

export type UpdateUserProfileInput = z.infer<typeof updateUserProfileSchema>;

export const updateNotificationPreferencesSchema = z
  .object({
    productEmailsEnabled: z.boolean().optional(),
    weeklySummaryEnabled: z.boolean().optional(),
  })
  .refine(
    (input) => input.productEmailsEnabled !== undefined || input.weeklySummaryEnabled !== undefined,
    { message: "Choose a notification setting to change" },
  );

export type UpdateNotificationPreferencesInput = z.infer<
  typeof updateNotificationPreferencesSchema
>;
