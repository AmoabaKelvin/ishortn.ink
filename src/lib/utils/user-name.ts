// The Clerk webhook used to template `${first_name} ${last_name}`, so email sign-ups were
// stored as "null null" (or "Ama null"). Those parts are treated as missing on read.
const MISSING_NAME_PARTS = new Set(["null", "undefined"]);

/** Joins the name parts that are set, or null when none are. */
export function fullName(...parts: (string | null | undefined)[]): string | null {
  return parts.filter(Boolean).join(" ") || null;
}

/** The user's name without literal "null"/"undefined" parts, or null when nothing real is left. */
export function displayName(name: string | null | undefined): string | null {
  if (!name) return null;
  return fullName(
    ...name
      .trim()
      .split(/\s+/)
      .filter((part) => !MISSING_NAME_PARTS.has(part)),
  );
}

/** The first word of the user's display name, or null when they have no real name. */
export function firstName(name: string | null | undefined): string | null {
  return displayName(name)?.split(" ")[0] ?? null;
}
