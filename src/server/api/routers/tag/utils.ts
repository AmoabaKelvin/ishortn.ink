/** Tag names are stored lowercase, so "Marketing" and "marketing" are the same tag. */
export function normalizeTagName(name: string): string {
  return name.trim().toLowerCase();
}

/** Normalised, de-duplicated tag names in first-seen order, blanks dropped. */
export function normalizeTagNames(names: string[]): string[] {
  return [...new Set(names.map(normalizeTagName).filter(Boolean))];
}
