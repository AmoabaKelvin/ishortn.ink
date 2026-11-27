import { z } from "zod";

export const MAX_REPORT_RECIPIENTS = 5;

const target = {
  targetType: z.enum(["link", "folder", "campaign"]),
  targetId: z.number().int().positive(),
};

const schedule = {
  frequency: z.enum(["weekly", "monthly"]),
  recipients: z
    .array(z.string().trim().toLowerCase().email("Enter valid email addresses").max(255))
    .min(1, "Add at least one email address")
    .max(MAX_REPORT_RECIPIENTS, `Add up to ${MAX_REPORT_RECIPIENTS} email addresses`)
    .transform((emails) => [...new Set(emails)]),
};

export const listScheduledReportsInput = z.object(target);

export const createScheduledReportInput = z.object({ ...target, ...schedule });

export const updateScheduledReportInput = z.object({
  id: z.number().int().positive(),
  ...schedule,
});

export const deleteScheduledReportInput = z.object({ id: z.number().int().positive() });

export type ListScheduledReportsInput = z.infer<typeof listScheduledReportsInput>;
export type CreateScheduledReportInput = z.infer<typeof createScheduledReportInput>;
export type UpdateScheduledReportInput = z.infer<typeof updateScheduledReportInput>;
export type DeleteScheduledReportInput = z.infer<typeof deleteScheduledReportInput>;
