import { formatDistanceToNow } from "date-fns";

// Kept out of @/lib/utils: every client component imports `cn` from there, and date-fns would
// otherwise ship on pages that never format a date.
export function timeAgo(date: Date | string | null): string {
  if (!date) return "";
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}
