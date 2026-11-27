import { z } from "zod";

import { MAX_REPORT_RECIPIENTS } from "@/server/api/routers/scheduled-report/scheduled-report.input";

const email = z.string().email();

/**
 * Reads the recipients field: addresses separated by commas, semicolons, spaces or new lines,
 * lowercased and de-duplicated. Returns the addresses or the message to show under the field.
 */
export function parseRecipients(value: string): { emails: string[] } | { error: string } {
  const emails = [
    ...new Set(
      value
        .split(/[\s,;]+/)
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  if (!emails.length) return { error: "Add at least one email address" };
  const invalid = emails.find((item) => !email.safeParse(item).success);
  if (invalid) return { error: `${invalid} isn't a valid email address` };
  if (emails.length > MAX_REPORT_RECIPIENTS) {
    return { error: `Add up to ${MAX_REPORT_RECIPIENTS} email addresses` };
  }
  return { emails };
}
