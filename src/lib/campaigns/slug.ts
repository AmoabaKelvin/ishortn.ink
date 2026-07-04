/**
 * Shared by the server (persistence) and the client (live previews) so what
 * the user sees is exactly what is saved.
 */
export function normalizeCampaignSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 100)
    .replace(/^-+|-+$/g, "");
}
