// Shared by the v1 API responses and webhook payloads, so integrations see one link shape.

/** The public shape of a link in v1 responses; never includes the password hash. */
export function toApiLink(retrievedLink: {
  id: number;
  createdAt: Date | null;
  domain: string;
  alias: string | null;
  url: string | null;
  disableLinkAfterDate: Date | null;
  activateAt: Date | null;
  disableLinkAfterClicks: number | null;
}) {
  return {
    // Stable across renames, so integrations can dedupe on it instead of shortLink.
    id: retrievedLink.id,
    shortLink: `https://${retrievedLink.domain}/${retrievedLink.alias}`,
    url: retrievedLink.url,
    alias: retrievedLink.alias,
    createdAt: retrievedLink.createdAt,
    expiresAt: retrievedLink.disableLinkAfterDate,
    activatesAt: retrievedLink.activateAt,
    expiresAfter: retrievedLink.disableLinkAfterClicks,
  };
}
