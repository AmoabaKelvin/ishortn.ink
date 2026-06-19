import { z } from "zod";

export const abuseCategoryValues = [
  "phishing",
  "malware",
  "spam",
  "impersonation",
  "illegal",
  "privacy",
  "other",
] as const;

export const ABUSE_CATEGORY_LABELS: Record<(typeof abuseCategoryValues)[number], string> = {
  phishing: "Phishing",
  malware: "Malware",
  spam: "Spam",
  impersonation: "Impersonation",
  illegal: "Illegal content",
  privacy: "Privacy violation",
  other: "Other",
};

export const reportAbuseSchema = z.object({
  shortUrl: z.string().trim().min(1, "Enter the short link you want to report.").max(2048),
  category: z.enum(abuseCategoryValues),
  reporterEmail: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .max(320)
    .optional()
    .or(z.literal("")),
  details: z.string().trim().max(2000).optional(),
});

export type ReportAbuseInput = z.infer<typeof reportAbuseSchema>;
