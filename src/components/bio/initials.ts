// Up to two initials for the avatar fallback ("Ada Lovelace" -> "AL"). Words
// with no letter or digit (emoji, punctuation) are skipped.
export function getInitials(title: string | null): string {
  if (!title) return "";
  const initials = title
    .split(/\s+/)
    .map((word) => word.match(/[\p{L}\p{N}]/u)?.[0])
    .filter((char): char is string => !!char);
  const picked = initials.length > 1 ? [initials[0], initials.at(-1)] : initials;
  return picked.join("").toUpperCase();
}
